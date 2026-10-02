import json
import os
import requests
from typing import Dict, Any, Sequence
from config.env_keys import env_value_ring
from .base import BaseLLMProvider

class GeminiAPIProvider(BaseLLMProvider):
    """
    LLM Provider that uses the official Gemini REST API.
    """
    
    def __init__(self, api_key: str = None, model: str = None, api_keys: Sequence[str] | None = None):
        if api_keys is not None:
            keys = tuple(dict.fromkeys(key.strip() for key in api_keys if key and key.strip()))
        elif api_key:
            keys = (api_key.strip(),)
        else:
            keys = env_value_ring("GEMINI_API_KEY", "GEMINI_API_KEYS")
        if not keys:
            raise ValueError(
                "Gemini API key is required. Set GEMINI_API_KEY, GEMINI_API_KEYS, "
                "or a numbered GEMINI_API_KEY_n variable."
            )
        self.api_keys = keys
        self.api_key = keys[0]
        self.model = model or os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
        self.url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent"

    def generate(self, prompt: str, system_prompt: str = "", tools: list = None) -> Dict[str, Any]:
        full_prompt = prompt
        if system_prompt:
            full_prompt = f"System Instruction: {system_prompt}\n\nUser: {prompt}"
            
        if tools:
            tool_instruction = (
                "You have access to the following tools:\n"
                f"{json.dumps(tools, indent=2)}\n"
                "If you need to use a tool, output a JSON object with 'tool_name' and 'tool_args'. "
                "Otherwise, output a JSON object with 'response' containing your final answer."
            )
            full_prompt = f"{tool_instruction}\n\n{full_prompt}"
            
        payload = {
            "contents": [{
                "parts": [{"text": full_prompt}]
            }],
            "generationConfig": {
                "responseMimeType": "application/json"
            }
        }
        
        response = None
        for index, api_key in enumerate(self.api_keys):
            headers = {
                'Content-Type': 'application/json',
                'x-goog-api-key': api_key
            }
            try:
                response = requests.post(self.url, headers=headers, json=payload, timeout=30)
                response.raise_for_status()
                break
            except requests.exceptions.RequestException as e:
                failed_response = getattr(e, "response", None)
                status_code = failed_response.status_code if failed_response is not None else 500
                api_message = str(e)
                if failed_response is not None:
                    try:
                        error_payload = failed_response.json()
                        api_message = error_payload.get("error", {}).get("message") or api_message
                    except (ValueError, AttributeError):
                        pass
                retry_with_next_key = (
                    status_code in {401, 403, 429}
                    or any(marker in api_message.lower() for marker in ("quota", "rate limit", "resource_exhausted", "exhausted"))
                )
                if retry_with_next_key and index + 1 < len(self.api_keys):
                    continue
                return self._error_result(e, api_message=api_message, attempted_keys=index + 1)

        if response is None:
            return {"type": "error", "text": "Gemini API request did not produce a response.", "status_code": 500}

        try:
            data = response.json()
            try:
                output_text = data['candidates'][0]['content']['parts'][0]['text']
            except (KeyError, IndexError):
                return {"type": "error", "text": "Unexpected response format from Gemini API."}
                
            # Extract token usage metadata
            usage_meta = data.get("usageMetadata", {})
            prompt_tokens = usage_meta.get("promptTokenCount") or max(1, len(full_prompt) // 4)
            completion_tokens = usage_meta.get("candidatesTokenCount") or max(1, len(output_text) // 4)
            total_tokens = usage_meta.get("totalTokenCount") or (prompt_tokens + completion_tokens)
            try:
                parsed_output = json.loads(output_text)
                if isinstance(parsed_output, dict) and 'tool_name' in parsed_output:
                    return {
                        "type": "tool_call",
                        "tool_name": parsed_output["tool_name"],
                        "tool_args": parsed_output.get("tool_args", {}),
                        "prompt_tokens": prompt_tokens,
                        "completion_tokens": completion_tokens,
                        "total_tokens": total_tokens
                    }
                elif isinstance(parsed_output, dict):
                    return {
                        "type": "text",
                        "text": parsed_output.get("response", output_text),
                        "prompt_tokens": prompt_tokens,
                        "completion_tokens": completion_tokens,
                        "total_tokens": total_tokens
                    }
                else:
                    return {
                        "type": "text",
                        "text": output_text,
                        "prompt_tokens": prompt_tokens,
                        "completion_tokens": completion_tokens,
                        "total_tokens": total_tokens
                    }
            except json.JSONDecodeError:
                return {
                    "type": "text",
                    "text": output_text,
                    "prompt_tokens": prompt_tokens,
                    "completion_tokens": completion_tokens,
                    "total_tokens": total_tokens
                }
                
        except (ValueError, KeyError, IndexError) as exc:
            return {"type": "error", "text": f"Unexpected response from Gemini API: {exc}", "status_code": 502}

    @staticmethod
    def _error_result(error, *, api_message: str, attempted_keys: int) -> Dict[str, Any]:
        response = getattr(error, "response", None)
        status_code = response.status_code if response is not None else 500
        retry_after = response.headers.get("Retry-After") if response is not None else None
        return {
            "type": "error",
            "text": f"Error calling Gemini REST API ({status_code}): {api_message}",
            "status_code": status_code,
            "retry_after": retry_after,
            "attempted_keys": attempted_keys,
        }
