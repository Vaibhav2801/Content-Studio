from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import requests
from django.conf import settings


class VideoGenerationError(RuntimeError):
    """Base error for failures while generating a video."""


class VideoGenerationConfigurationError(VideoGenerationError):
    """The video provider is missing credentials or rejected configuration."""


class VideoGenerationQuotaError(VideoGenerationError):
    """The video provider rejected the request because quota is unavailable."""


class VideoProviderUnavailableError(VideoGenerationError):
    """The configured video provider could not service the request."""


@dataclass(frozen=True)
class VideoOperationResult:
    done: bool
    video_uri: str = ""
    error: str = ""


def _gemini_video_keys() -> tuple[str, ...]:
    values = [
        str(value).strip()
        for value in getattr(settings, "GEMINI_API_KEYS", ())
        if str(value).strip()
    ]
    singular = str(getattr(settings, "GEMINI_API_KEY", "") or "").strip()
    if singular and singular not in values:
        values.insert(0, singular)
    return tuple(values)


def video_provider_status() -> dict[str, Any]:
    enabled = bool(getattr(settings, "SOCIAL_GENERATE_VIDEOS", False))
    keys = _gemini_video_keys()
    return {
        "ready": enabled and bool(keys),
        "label": "Gemini Veo video",
        "detail": (
            "Ready for 8-second social videos"
            if enabled and keys
            else "Enable SOCIAL_GENERATE_VIDEOS and configure GEMINI_API_KEY"
        ),
    }


class GeminiVideoGenerator:
    """Small async REST client for Gemini Veo long-running video jobs."""

    base_url = "https://generativelanguage.googleapis.com/v1beta"

    @staticmethod
    def art_direct(prompt: str, *, aspect_ratio: str) -> str:
        orientation = "vertical portrait" if aspect_ratio == "9:16" else "landscape"
        return f"""
Create one polished 8-second {orientation} social-media video with synchronized ambient audio.

CORE IDEA
{prompt.strip()}

MOTION AND COMPOSITION
- Establish one clear focal subject immediately and use smooth, intentional motion.
- Keep the action coherent, physically plausible, and readable on a phone.
- Use a stable cinematic camera move and preserve subject consistency throughout the clip.
- Do not add captions, words, letters, logos, watermarks, UI elements, borders, or split screens.
- Do not invent product interfaces, customer identities, statistics, awards, or brand marks.
""".strip()

    @staticmethod
    def _raise_provider_error(response, provider: str = "Gemini Veo") -> None:
        try:
            response.raise_for_status()
        except requests.HTTPError as exc:
            try:
                payload = response.json()
                error = payload.get("error") or {}
                message = error.get("message", "") if isinstance(error, dict) else str(error)
            except (TypeError, ValueError, AttributeError):
                message = ""
            detail = f": {message}" if message else ""
            if response.status_code == 429:
                raise VideoGenerationQuotaError(
                    f"{provider} quota is unavailable. Enable billing or increase the video-model quota."
                ) from exc
            if response.status_code in {400, 401, 403}:
                raise VideoGenerationConfigurationError(
                    f"{provider} configuration was rejected ({response.status_code}){detail}"
                ) from exc
            if response.status_code >= 500:
                raise VideoProviderUnavailableError(
                    f"{provider} is temporarily unavailable ({response.status_code}){detail}"
                ) from exc
            raise VideoGenerationError(
                f"{provider} request failed ({response.status_code}){detail}"
            ) from exc

    def start(
        self,
        prompt: str,
        *,
        aspect_ratio: str,
        duration_seconds: int = 8,
        resolution: str = "720p",
    ) -> tuple[str, int]:
        keys = _gemini_video_keys()
        if not getattr(settings, "SOCIAL_GENERATE_VIDEOS", False) or not keys:
            raise VideoGenerationConfigurationError("Gemini Veo video generation is not configured.")
        model = settings.GEMINI_VIDEO_MODEL
        endpoint = f"{self.base_url}/models/{model}:predictLongRunning"
        payload = {
            "instances": [{"prompt": self.art_direct(prompt, aspect_ratio=aspect_ratio)}],
            "parameters": {
                "aspectRatio": aspect_ratio,
                "durationSeconds": str(duration_seconds),
                "resolution": resolution,
                "numberOfVideos": 1,
            },
        }
        last_response = None
        for index, api_key in enumerate(keys):
            try:
                response = requests.post(
                    endpoint,
                    headers={"x-goog-api-key": api_key, "Content-Type": "application/json"},
                    json=payload,
                    timeout=settings.SOCIAL_VIDEO_HTTP_TIMEOUT_SECONDS,
                )
            except requests.RequestException as exc:
                raise VideoProviderUnavailableError("Gemini Veo could not be reached.") from exc
            last_response = response
            if response.ok:
                operation_name = str(response.json().get("name") or "").strip()
                if not operation_name:
                    raise VideoGenerationError("Gemini Veo returned no operation identifier.")
                return operation_name, index
            if response.status_code in {401, 403, 429} and index + 1 < len(keys):
                continue
            self._raise_provider_error(response)
        if last_response is not None:
            self._raise_provider_error(last_response)
        raise VideoGenerationConfigurationError("No Gemini API keys are configured.")

    def poll(self, operation_name: str, *, key_index: int = 0) -> VideoOperationResult:
        keys = _gemini_video_keys()
        if not keys:
            raise VideoGenerationConfigurationError("No Gemini API keys are configured.")
        api_key = keys[min(max(int(key_index), 0), len(keys) - 1)]
        try:
            response = requests.get(
                f"{self.base_url}/{operation_name.lstrip('/')}",
                headers={"x-goog-api-key": api_key},
                timeout=settings.SOCIAL_VIDEO_HTTP_TIMEOUT_SECONDS,
            )
        except requests.RequestException as exc:
            raise VideoProviderUnavailableError("Gemini Veo status could not be reached.") from exc
        self._raise_provider_error(response)
        payload = response.json()
        if not payload.get("done"):
            return VideoOperationResult(done=False)
        if payload.get("error"):
            error = payload["error"]
            message = error.get("message", "Video generation failed.") if isinstance(error, dict) else str(error)
            return VideoOperationResult(done=True, error=message)
        samples = (
            payload.get("response", {})
            .get("generateVideoResponse", {})
            .get("generatedSamples", [])
        )
        video_uri = str((samples[0].get("video") or {}).get("uri") or "") if samples else ""
        if not video_uri:
            return VideoOperationResult(done=True, error="The provider returned no generated video.")
        return VideoOperationResult(done=True, video_uri=video_uri)

    def download(self, video_uri: str, *, key_index: int = 0) -> bytes:
        keys = _gemini_video_keys()
        if not keys:
            raise VideoGenerationConfigurationError("No Gemini API keys are configured.")
        api_key = keys[min(max(int(key_index), 0), len(keys) - 1)]
        try:
            response = requests.get(
                video_uri,
                headers={"x-goog-api-key": api_key},
                timeout=settings.SOCIAL_VIDEO_DOWNLOAD_TIMEOUT_SECONDS,
                allow_redirects=True,
            )
        except requests.RequestException as exc:
            raise VideoProviderUnavailableError("The generated video could not be downloaded.") from exc
        self._raise_provider_error(response, "Gemini Veo download")
        if not response.content:
            raise VideoGenerationError("The provider returned an empty video file.")
        return response.content
