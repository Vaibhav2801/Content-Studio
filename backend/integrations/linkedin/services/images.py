import base64

import requests
from django.conf import settings


GEMINI_ASPECT_RATIOS = {
    "4:5": "ASPECT_RATIO_FOUR_BY_FIVE",
    "1.91:1": "ASPECT_RATIO_SIXTEEN_BY_NINE",
    "16:9": "ASPECT_RATIO_SIXTEEN_BY_NINE",
}
PLATFORM_IMAGE_SPECS = {
    "LINKEDIN": {"ratio": "1.91:1", "width": 1024, "height": 536},
    "X": {"ratio": "16:9", "width": 1024, "height": 576},
    "INSTAGRAM": {"ratio": "4:5", "width": 1024, "height": 1280},
}
GEMINI_IMAGE_SIZES = {
    "512": "IMAGE_SIZE_FIVE_TWELVE",
    "1K": "IMAGE_SIZE_ONE_K",
    "2K": "IMAGE_SIZE_TWO_K",
    "4K": "IMAGE_SIZE_FOUR_K",
}


class ImageGenerationError(RuntimeError):
    """Base error for failures while generating an image."""


class ImageGenerationConfigurationError(ImageGenerationError):
    """The provider rejected credentials or request configuration."""


class ImageGenerationQuotaError(ImageGenerationError):
    """The provider rejected the request because quota is unavailable."""


class ImageProviderUnavailableError(ImageGenerationError):
    """The configured image provider could not service the request."""


def _setting_values(plural_name, singular_name):
    values = [str(value).strip() for value in getattr(settings, plural_name, ()) if str(value).strip()]
    singular = str(getattr(settings, singular_name, "") or "").strip()
    if singular and singular not in values:
        values.insert(0, singular)
    return tuple(values)


def _gemini_keys():
    return _setting_values("GEMINI_API_KEYS", "GEMINI_API_KEY")


def _cloudflare_credentials():
    accounts = _setting_values("CLOUDFLARE_ACCOUNT_IDS", "CLOUDFLARE_ACCOUNT_ID")
    tokens = _setting_values("CLOUDFLARE_API_TOKENS", "CLOUDFLARE_API_TOKEN")
    if not accounts or not tokens:
        return ()
    if len(accounts) == 1:
        return tuple((accounts[0], token) for token in tokens)
    if len(tokens) == 1:
        return tuple((account, tokens[0]) for account in accounts)
    if len(accounts) != len(tokens):
        raise ImageGenerationConfigurationError(
            "Cloudflare account and token fallback lists must have matching lengths, "
            "unless one side contains a single shared value."
        )
    return tuple(zip(accounts, tokens))


def _response_allows_key_failover(response):
    if response.status_code in {401, 403, 429}:
        return True
    try:
        payload = response.json()
        error = payload.get("error") or payload.get("errors") or ""
        message = error.get("message", "") if isinstance(error, dict) else str(error)
    except (TypeError, ValueError, AttributeError):
        message = ""
    return any(marker in message.lower() for marker in ("quota", "rate limit", "resource_exhausted", "exhausted"))


def _raise_provider_error(response, provider):
    try:
        response.raise_for_status()
    except requests.HTTPError as exc:
        try:
            payload = response.json()
            error = payload.get("error") or {}
            message = error.get("message", "") if isinstance(error, dict) else str(error)
            if not message:
                errors = payload.get("errors") or []
                message = "; ".join(
                    item.get("message", "") if isinstance(item, dict) else str(item)
                    for item in errors
                ).strip("; ")
        except (TypeError, ValueError):
            message = ""
        if response.status_code == 429:
            raise ImageGenerationQuotaError(
                f"{provider} image quota is unavailable. Enable billing or increase the image-model quota, then try again."
            ) from exc
        detail = f": {message}" if message else ""
        if response.status_code in {400, 401, 403}:
            raise ImageGenerationConfigurationError(
                f"{provider} image configuration was rejected ({response.status_code}){detail}"
            ) from exc
        if response.status_code >= 500:
            raise ImageProviderUnavailableError(
                f"{provider} image provider is unavailable ({response.status_code}){detail}"
            ) from exc
        raise ImageGenerationError(f"{provider} image request failed ({response.status_code}){detail}") from exc


def image_provider_status():
    if not settings.LINKEDIN_GENERATE_IMAGES:
        return {"ready": False, "label": "Image generation is off", "detail": "Set LINKEDIN_GENERATE_IMAGES=True"}
    provider = settings.LINKEDIN_IMAGE_PROVIDER
    if provider == "cloudflare":
        ready = bool(_cloudflare_credentials())
        label, missing = "Cloudflare AI image", "CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN"
    elif provider == "gemini":
        ready, label, missing = bool(_gemini_keys()), "Gemini image", "GEMINI_API_KEY or GEMINI_API_KEYS"
    elif provider == "openai":
        ready, label, missing = bool(settings.OPENAI_API_KEY), "OpenAI image", "OPENAI_API_KEY"
    else:
        cloudflare_ready = bool(_cloudflare_credentials())
        gemini_ready = bool(_gemini_keys())
        ready = bool(
            cloudflare_ready
            or gemini_ready
            or settings.OPENAI_API_KEY
        )
        label = (
            "Cloudflare AI image"
            if cloudflare_ready
            else "Gemini image"
            if gemini_ready
            else "OpenAI image"
            if settings.OPENAI_API_KEY
            else "Automatic image provider"
        )
        missing = "Cloudflare account/token credentials, GEMINI_API_KEY, or OPENAI_API_KEY"
    return {
        "ready": ready,
        "label": label,
        "detail": "Ready for platform-sized post images" if ready else f"Add {missing}",
    }


class LinkedInImageGenerator:
    """Generate artwork that is normalized for each social platform."""

    openai_endpoint = "https://api.openai.com/v1/images/generations"
    gemini_endpoint = "https://generativelanguage.googleapis.com/v1/models/{model}:generateContent"
    cloudflare_endpoint = "https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/{model}"

    @staticmethod
    def art_direct(prompt, network="LINKEDIN"):
        platform = {
            "LINKEDIN": "LinkedIn",
            "X": "X",
            "INSTAGRAM": "Instagram",
        }.get(str(network), "social media")
        spec = PLATFORM_IMAGE_SPECS.get(str(network), PLATFORM_IMAGE_SPECS["LINKEDIN"])
        return f"""
Create one finished, visually engaging artwork for a {platform} post depicting the following scene.
{prompt.strip()}

Use a single clear focal concept that communicates the idea in under two seconds.
Compose for a {spec['ratio']} feed canvas with breathing room and safe margins. Keep essential details in the central 80% of the frame.
Follow the supplied brand visual style, palette and medium: photography, illustration or dimensional artwork
according to that direction. Make the subject concrete and recognizable, with a purposeful action or meaningful
detail connected to the post. Establish hierarchy through intentional color contrast, depth, believable textures,
and deliberate lighting. Keep the background simple enough to read on a phone. Produce a polished campaign-quality finish.

The finished artwork is entirely pictorial: any paper, cards or other surfaces are blank and unmarked.
Use coherent, physically plausible objects. If people appear, use natural anatomy; exclude disconnected hands,
extra fingers or limbs, and impossible object intersections.
Exclude all lettering, printed documents, words, captions, numbers, logos, watermarks and interface screens.
Do not depict this prompt, its headings, a page of instructions, or a screenshot. Avoid generic office teams,
handshakes, random charts, unrelated props, borders, or split-screen collage. Never invent customer identities,
product screenshots, statistics, awards or brand marks.

Return only the final image.
""".strip()

    def generate(self, post_id, prompt, network="LINKEDIN"):
        if not settings.LINKEDIN_GENERATE_IMAGES:
            return "", {"status": "not_configured"}, b""
        directed_prompt = self.art_direct(prompt, network=network)
        spec = PLATFORM_IMAGE_SPECS.get(str(network), PLATFORM_IMAGE_SPECS["LINKEDIN"])
        provider = settings.LINKEDIN_IMAGE_PROVIDER
        errors = []
        if provider in {"auto", "cloudflare"} and _cloudflare_credentials():
            try:
                return self._generate_cloudflare(post_id, directed_prompt, spec=spec)
            except Exception as exc:
                if provider == "cloudflare":
                    raise
                errors.append(f"Cloudflare: {exc}")
        if provider in {"auto", "gemini"} and _gemini_keys():
            try:
                return self._generate_gemini(post_id, directed_prompt, spec=spec)
            except Exception as exc:
                if provider == "gemini":
                    raise
                errors.append(f"Gemini: {exc}")
        if provider in {"auto", "openai"} and settings.OPENAI_API_KEY:
            try:
                return self._generate_openai(post_id, directed_prompt, spec=spec)
            except Exception as exc:
                if provider == "openai":
                    raise
                errors.append(f"OpenAI: {exc}")
        if errors:
            raise RuntimeError("; ".join(errors))
        return "", {
            "status": "not_configured",
            "detail": "Add Cloudflare account/token credentials, GEMINI_API_KEY, or OPENAI_API_KEY",
        }, b""

    def _generate_cloudflare(self, post_id, prompt, *, spec):
        model = settings.CLOUDFLARE_IMAGE_MODEL
        steps = settings.CLOUDFLARE_IMAGE_STEPS
        # FLUX.2 dev needs more than the four-step setting intended for distilled models.
        if model == "@cf/black-forest-labs/flux-2-dev":
            steps = max(25, steps)
        # FLUX.2 models require multipart form data, including for prompt-only requests.
        if model.startswith("@cf/black-forest-labs/flux-2"):
            response_kwargs = {
                "files": {
                    "prompt": (None, prompt),
                    "steps": (None, str(steps)),
                    "width": (None, str(spec["width"])),
                    "height": (None, str(spec["height"])),
                },
            }
        else:
            response_kwargs = {
                "json": {
                    "prompt": prompt,
                    "steps": steps,
                },
            }
        credentials = _cloudflare_credentials()
        for index, (account_id, token) in enumerate(credentials):
            endpoint = self.cloudflare_endpoint.format(account_id=account_id, model=model)
            try:
                response = requests.post(
                    endpoint,
                    headers={"Authorization": f"Bearer {token}"},
                    timeout=settings.LINKEDIN_HTTP_TIMEOUT_SECONDS,
                    **response_kwargs,
                )
            except requests.RequestException as exc:
                raise ImageProviderUnavailableError("Cloudflare AI image provider could not be reached.") from exc
            try:
                response.raise_for_status()
                break
            except requests.HTTPError:
                pass
            if _response_allows_key_failover(response) and index + 1 < len(credentials):
                continue
            _raise_provider_error(response, "Cloudflare AI")
        else:
            raise ImageGenerationConfigurationError("No Cloudflare AI credentials are configured.")
        response_headers = getattr(response, "headers", {}) or {}
        content_type = response_headers.get("content-type", "") if hasattr(response_headers, "get") else ""
        if not isinstance(content_type, str):
            content_type = ""
        raw_response = getattr(response, "content", b"") or b""
        if not isinstance(raw_response, (bytes, bytearray)):
            raw_response = b""
        try:
            payload = response.json()
        except (TypeError, ValueError):
            # Cloudflare's REST API may return the generated PNG directly instead
            # of wrapping it in JSON, depending on the model/API response mode.
            if content_type.startswith("image/") or raw_response.startswith(b"\x89PNG\r\n\x1a\n"):
                return self._result(post_id, raw_response, "cloudflare", model, content_type or "image/png", spec["ratio"])
            raise ImageGenerationError("Cloudflare AI returned an invalid image response.")
        if isinstance(payload, dict):
            result = payload.get("result") or {}
            encoded_image = result.get("image") if isinstance(result, dict) else result
        else:
            encoded_image = payload
        if not encoded_image:
            raise ImageGenerationError("Cloudflare AI returned no image data.")
        try:
            raw_bytes = base64.b64decode(encoded_image)
        except (TypeError, ValueError) as exc:
            raise ImageGenerationError("Cloudflare AI returned invalid image data.") from exc
        return self._result(post_id, raw_bytes, "cloudflare", model, "image/png", spec["ratio"])

    def _generate_gemini(self, post_id, prompt, *, spec):
        keys = _gemini_keys()
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "responseModalities": ["IMAGE"],
                "responseFormat": {"image": {
                    "aspectRatio": GEMINI_ASPECT_RATIOS[spec["ratio"]],
                    "imageSize": GEMINI_IMAGE_SIZES.get(settings.GEMINI_IMAGE_SIZE, "IMAGE_SIZE_ONE_K"),
                }},
            },
        }
        for index, api_key in enumerate(keys):
            try:
                response = requests.post(
                    self.gemini_endpoint.format(model=settings.GEMINI_IMAGE_MODEL),
                    headers={"x-goog-api-key": api_key, "Content-Type": "application/json"},
                    json=payload,
                    timeout=settings.LINKEDIN_HTTP_TIMEOUT_SECONDS,
                )
            except requests.RequestException as exc:
                raise ImageProviderUnavailableError("Gemini image provider could not be reached.") from exc
            try:
                response.raise_for_status()
                break
            except requests.HTTPError:
                pass
            if _response_allows_key_failover(response) and index + 1 < len(keys):
                continue
            _raise_provider_error(response, "Gemini")
        else:
            raise ImageGenerationConfigurationError("No Gemini API keys are configured.")
        data = response.json()
        parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
        image_part = next((item.get("inlineData") or item.get("inline_data") for item in parts if item.get("inlineData") or item.get("inline_data")), None)
        if not image_part or not image_part.get("data"):
            raise ImageGenerationError("Gemini returned no image data.")
        raw_bytes = base64.b64decode(image_part["data"])
        content_type = image_part.get("mimeType") or image_part.get("mime_type") or "image/png"
        return self._result(post_id, raw_bytes, "gemini", settings.GEMINI_IMAGE_MODEL, content_type, spec["ratio"])

    def _generate_openai(self, post_id, prompt, *, spec):
        try:
            response = requests.post(
                self.openai_endpoint,
                headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}", "Content-Type": "application/json"},
                json={
                    "model": settings.OPENAI_IMAGE_MODEL,
                    "prompt": prompt,
                    "size": "1024x1536" if spec["height"] > spec["width"] else "1536x1024",
                    "quality": settings.OPENAI_IMAGE_QUALITY,
                    "output_format": "png",
                },
                timeout=settings.LINKEDIN_HTTP_TIMEOUT_SECONDS,
            )
        except requests.RequestException as exc:
            raise ImageProviderUnavailableError("OpenAI image provider could not be reached.") from exc
        _raise_provider_error(response, "OpenAI")
        item = response.json()["data"][0]
        if item.get("url"):
            try:
                image_response = requests.get(item["url"], timeout=settings.LINKEDIN_HTTP_TIMEOUT_SECONDS)
            except requests.RequestException as exc:
                raise ImageProviderUnavailableError("OpenAI image download could not be reached.") from exc
            _raise_provider_error(image_response, "OpenAI image download")
            raw_bytes = image_response.content
        else:
            raw = item.get("b64_json")
            if not raw:
                raise ImageGenerationError("OpenAI returned no image data.")
            raw_bytes = base64.b64decode(raw)
        return self._result(post_id, raw_bytes, "openai", settings.OPENAI_IMAGE_MODEL, "image/png", spec["ratio"])

    @staticmethod
    def _result(post_id, raw_bytes, provider, model, content_type, aspect_ratio):
        url = f"{settings.PUBLIC_BACKEND_URL}/api/v3/linkedin/posts/{post_id}/image/"
        metadata = {
            "status": "generated",
            "provider": provider,
            "model": model,
            "content_type": content_type,
            "bytes": len(raw_bytes),
            "aspect_ratio": aspect_ratio,
        }
        return url, metadata, raw_bytes


# Backwards-compatible import for existing callers and tests.
OpenAIImageGenerator = LinkedInImageGenerator
