import uuid
from django.core.management.base import BaseCommand, CommandError
from integrations.social.models import (
    EngagementAutomation,
    EngagementAutomationKind,
    EngagementContact,
    EngagementItemKind,
    EngagementReviewItem,
    SocialConnection,
    SocialNetwork,
)
from integrations.social.services.engagement import (
    _automation_for,
    _generic_suggestion,
)


class Command(BaseCommand):
    help = "Simulate an engagement trigger (Comment to DM or Story Reply) to test automations."

    def add_arguments(self, parser):
        parser.add_argument("--automation-id", type=str, help="UUID of the EngagementAutomation to test.")
        parser.add_argument("--name", type=str, help="Name of the EngagementAutomation to test.")
        parser.add_argument("--kind", type=str, choices=["COMMENT_TO_DM", "STORY_REPLY", "DM_KEYWORD"], help="Automation kind to test.")
        parser.add_argument("--text", type=str, help="Incoming message or comment text.")
        parser.add_argument("--handle", type=str, default="@test_customer", help="Simulated Instagram handle.")

    def handle(self, *args, **options):
        automation_id = options.get("automation_id")
        name = options.get("name")
        kind_arg = options.get("kind")
        text_arg = options.get("text")
        handle = options["handle"]
        if not handle.startswith("@"):
            handle = f"@{handle}"

        automation = None
        if automation_id:
            try:
                automation = EngagementAutomation.objects.select_related("connection", "workspace").get(pk=automation_id)
            except EngagementAutomation.DoesNotExist:
                raise CommandError(f"Automation with ID '{automation_id}' does not exist.")
        elif name:
            automation = EngagementAutomation.objects.select_related("connection", "workspace").filter(name__icontains=name).first()
            if not automation:
                raise CommandError(f"No automation matching name '{name}' found.")

        if automation:
            connection = automation.connection
            kind = automation.kind
            text = text_arg or (automation.keywords[0] if automation.keywords else ("HI" if kind == EngagementAutomationKind.STORY_REPLY else "PRICE"))
            workspace = automation.workspace
        else:
            kind = kind_arg or EngagementAutomationKind.COMMENT_TO_DM
            connection = SocialConnection.objects.filter(network=SocialNetwork.INSTAGRAM).first()
            if not connection:
                raise CommandError("No Instagram connection found in database.")
            workspace = connection.workspace
            text = text_arg or ("PRICE" if kind == EngagementAutomationKind.COMMENT_TO_DM else "HI")

        self.stdout.write(self.style.NOTICE(f"Testing {kind} automation on account '{connection.display_name}' with text: '{text}'"))

        event_id = f"cli-test-{uuid.uuid4()}"
        contact, _ = EngagementContact.objects.update_or_create(
            workspace=workspace,
            platform=connection.network,
            provider_contact_id=f"test-contact-{uuid.uuid4().hex[:8]}",
            defaults={"display_name": handle.lstrip("@").capitalize(), "handle": handle},
        )

        created = []
        if kind == EngagementAutomationKind.COMMENT_TO_DM:
            matched = _automation_for(connection, EngagementAutomationKind.COMMENT_TO_DM, text) or automation
            if matched:
                self.stdout.write(self.style.SUCCESS(f"[MATCHED] Automation: '{matched.name}' (Status: {matched.status})"))
            else:
                self.stdout.write(self.style.WARNING("[NO MATCH] No active automation matched keyword. Generic suggestion will be prepared."))

            public_suggestion = (
                matched.approved_comment_reply.strip()
                if matched and matched.approved_comment_reply.strip()
                else _generic_suggestion(EngagementItemKind.COMMENT_REPLY, contact.display_name)
            )
            post_id = f"sim-post-{uuid.uuid4().hex[:8]}"
            comment_id = f"sim-comment-{uuid.uuid4().hex[:8]}"
            public_item = EngagementReviewItem.objects.create(
                workspace=workspace,
                connection=connection,
                contact=contact,
                kind=EngagementItemKind.COMMENT_REPLY,
                source_label=f"Comment keyword: {text}" if matched else "Social comment",
                incoming_text=text,
                suggested_text=public_suggestion,
                provider_post_id=post_id,
                provider_comment_id=comment_id,
                provider_event_id=event_id,
                assignee=matched.owner if matched else None,
                metadata={"automation_id": str(matched.id), "simulated": True} if matched else {"simulated": True},
            )
            created.append(public_item)

            if matched:
                private_item = EngagementReviewItem.objects.create(
                    workspace=workspace,
                    connection=connection,
                    contact=contact,
                    kind=EngagementItemKind.DIRECT_MESSAGE,
                    source_label=f"{matched.name} · private reply",
                    incoming_text=text,
                    suggested_text=matched.approved_dm_message,
                    provider_post_id=post_id,
                    provider_comment_id=comment_id,
                    provider_event_id=f"{event_id}:private",
                    assignee=matched.owner,
                    metadata={"automation_id": str(matched.id), "private_reply": True, "simulated": True},
                )
                matched.stats = {**matched.stats, "runs": int(matched.stats.get("runs", 0)) + 1}
                matched.save(update_fields=["stats", "updated_at"])
                created.append(private_item)

        else:
            is_story = kind == EngagementAutomationKind.STORY_REPLY
            matched = (
                _automation_for(connection, EngagementAutomationKind.STORY_REPLY, text)
                if is_story
                else _automation_for(connection, EngagementAutomationKind.DM_KEYWORD, text)
            ) or automation

            if matched:
                self.stdout.write(self.style.SUCCESS(f"[MATCHED] Automation: '{matched.name}' (Status: {matched.status})"))
            else:
                self.stdout.write(self.style.WARNING("[NO MATCH] No active automation matched keyword. Generic suggestion will be prepared."))

            review_kind = EngagementItemKind.STORY_REPLY if is_story else EngagementItemKind.DIRECT_MESSAGE
            item = EngagementReviewItem.objects.create(
                workspace=workspace,
                connection=connection,
                contact=contact,
                kind=review_kind,
                source_label=(matched.name if matched else "Story reply" if is_story else "Direct message"),
                incoming_text=text,
                suggested_text=matched.approved_dm_message if matched else _generic_suggestion(review_kind, contact.display_name),
                conversation_id=f"sim-conversation-{uuid.uuid4().hex[:8]}",
                provider_event_id=event_id,
                assignee=matched.owner if matched else None,
                metadata={"automation_id": str(matched.id), "simulated": True} if matched else {"simulated": True},
            )
            if matched:
                matched.stats = {**matched.stats, "runs": int(matched.stats.get("runs", 0)) + 1}
                matched.save(update_fields=["stats", "updated_at"])
            created.append(item)

        self.stdout.write(self.style.SUCCESS(f"\nCreated {len(created)} review item(s) in Review inbox:"))
        for item in created:
            self.stdout.write(f"  - [{item.get_kind_display()}] {item.source_label}")
            self.stdout.write(f"    From: {contact.handle}")
            self.stdout.write(f"    Incoming: \"{item.incoming_text}\"")
            self.stdout.write(f"    Suggested draft: \"{item.suggested_text}\"")
            self.stdout.write(f"    Status: {item.status} (Review Item ID: {item.id})\n")
