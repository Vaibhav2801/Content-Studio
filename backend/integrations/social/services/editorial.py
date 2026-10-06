"""Measurable generation requirements, separate from manual publishing limits."""

import re


LENGTH_TARGETS = {
    "LINKEDIN": {"Short": (250, 600), "Medium": (800, 1400), "Long": (1800, 2600)},
    "INSTAGRAM": {"Short": (100, 300), "Medium": (450, 900), "Long": (1200, 2000)},
    "X": {"Short": (45, 100), "Medium": (120, 185), "Long": (205, 270)},
}
LENGTH_STRUCTURE = {
    "Short": "One compelling hook, one useful takeaway, and a brief relevant next step. Cut setup and filler.",
    "Medium": "Hook, clear context, two or three useful details or an illustrative example, then one next step.",
    "Long": "Hook, develop the idea with context and three to five useful details, a clearly hypothetical example when helpful, and a memorable takeaway plus one next step. Add depth, never padding.",
}
EDITORIAL_HASHTAG_LIMITS = {"LINKEDIN": 3, "X": 1, "INSTAGRAM": 5}


def length_requirement(network, length):
    minimum, maximum = LENGTH_TARGETS[network][length]
    return {
        "minimum_characters": minimum,
        "maximum_characters": maximum,
        "measurement": "post copy including spaces and line breaks, excluding hashtags",
        "aim_for_characters": (minimum + maximum) // 2,
        "structure": (
            {"Short": "One sharp sentence, roughly 10–17 words. The useful point is the hook. Omit a separate CTA if it will not fit.",
             "Medium": "One sharp point in one or two sentences, roughly 20–30 words. Omit setup and optional CTA.",
             "Long": "One compact insight with a supporting detail or specific next step, roughly 35–45 words. Still one post, not a thread."}[length]
            if network == "X" else LENGTH_STRUCTURE[length]
        ),
        "hashtag_maximum": EDITORIAL_HASHTAG_LIMITS[network],
    }


def normalized_text(value):
    return " ".join(re.findall(r"\w+", str(value).casefold().replace("’", "'")))


def first_line(value):
    return next((line.strip() for line in str(value).splitlines() if line.strip()), "")


def readable_copy(copy):
    """Add paragraph breaks at sentence boundaries without changing or cutting words."""
    paragraphs = [part.strip() for part in re.split(r"\n\s*\n", copy) if part.strip()]
    formatted = []
    for index, paragraph in enumerate(paragraphs):
        sentences = re.split(r"(?<=[.!?。！？])\s+", paragraph)
        if index == 0 and len(first_line(paragraph)) > 180 and len(sentences[0]) <= 180:
            formatted.append(sentences.pop(0))
            paragraph = " ".join(sentences)
        if not paragraph:
            continue
        if len(paragraph) <= 450:
            formatted.append(paragraph)
            continue
        chunk = ""
        for sentence in sentences:
            if chunk and len(chunk) + len(sentence) + 1 > 450:
                formatted.append(chunk)
                chunk = ""
            chunk = f"{chunk} {sentence}".strip()
        if chunk:
            formatted.append(chunk)
    return "\n\n".join(formatted)


def draft_issues(item, *, network, controls, title, recent_hooks=(), accepted_copies=(), platform_limit):
    # Reuse the originality rules shown by the existing quality report.
    from integrations.social.services.quality import GENERIC_HOOKS

    copy = item["copy"]
    minimum, maximum = LENGTH_TARGETS[network][controls["length"]]
    issues = []
    if not minimum <= len(copy) <= maximum:
        issues.append(f"Copy has {len(copy)} characters; {controls['length']} requires {minimum}–{maximum}. Rewrite to fit without padding or cutting off sentences.")
    if len(copy) + sum(len(tag) + 1 for tag in item["hashtags"]) > platform_limit:
        issues.append(f"The complete post and hashtags exceed the {platform_limit}-character platform limit.")
    hook = normalized_text(first_line(copy))
    if network != "X" and len(first_line(copy)) > 180:
        issues.append("The opening is too long. Put a compelling hook of at most 180 characters on its own first line, then a blank line before the body.")
    if network != "X" and any(len(paragraph) > 450 for paragraph in re.split(r"\n\s*\n", copy)):
        issues.append("Break dense copy into readable paragraphs of at most 450 characters; use a blank line between paragraphs.")
    generic_hooks = (*GENERIC_HOOKS, "a closer look at", "here is the idea worth noticing", "what if the usual approach")
    if not hook or hook == normalized_text(title) or any(normalized_text(phrase) in hook for phrase in generic_hooks):
        issues.append("Replace the generic opening/title with a specific hook about the reader's problem, tension, or useful payoff.")
    if hook and hook in {normalized_text(value) for value in recent_hooks}:
        issues.append("The opening repeats a recent or already generated hook. Choose a fresh angle.")
    if normalized_text(copy) in {normalized_text(value) for value in accepted_copies}:
        issues.append("This duplicates another platform draft. Write a distinct platform-native version.")
    if (controls["include_image"] or network == "INSTAGRAM") and len(item["metadata"]["image_prompt"]) < 120:
        issues.append("Supply a detailed image concept: concrete subject/action, setting, composition, medium, lighting, palette, and platform-safe framing tied to this post.")
    return issues
