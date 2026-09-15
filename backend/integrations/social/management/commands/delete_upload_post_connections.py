import uuid

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from integrations.social.models import PublishJob, SocialConnection, SocialProvider


class Command(BaseCommand):
    help = (
        "Delete legacy Upload Post social-connection records from the local database. "
        "The command only previews changes unless --confirm is supplied."
    )

    def add_arguments(self, parser):
        scope = parser.add_mutually_exclusive_group(required=True)
        scope.add_argument(
            "--workspace",
            dest="workspace_id",
            type=uuid.UUID,
            help="Delete Upload Post connections belonging to this workspace UUID.",
        )
        scope.add_argument(
            "--all-workspaces",
            action="store_true",
            help="Delete Upload Post connections in every workspace.",
        )
        parser.add_argument(
            "--confirm",
            action="store_true",
            help="Apply the deletion. Without this flag, the command is a read-only preview.",
        )
        parser.add_argument(
            "--delete-publish-history",
            action="store_true",
            help=(
                "Also delete publish jobs (and their attempts) that protect a matching connection. "
                "Use only when the associated publishing history is no longer needed."
            ),
        )

    def handle(self, *args, **options):
        connections = SocialConnection.objects.filter(provider=SocialProvider.UPLOAD_POST)
        workspace_id = options.get("workspace_id")
        if workspace_id:
            connections = connections.filter(workspace_id=workspace_id)

        connections = connections.select_related("workspace").order_by("workspace_id", "network", "display_name")
        connection_ids = list(connections.values_list("id", flat=True))
        connection_count = len(connection_ids)
        publish_job_count = PublishJob.objects.filter(connection_id__in=connection_ids).count()

        scope_label = f"workspace {workspace_id}" if workspace_id else "all workspaces"
        self.stdout.write(
            f"Found {connection_count} Upload Post connection(s) in {scope_label}; "
            f"{publish_job_count} related publish job(s)."
        )

        for connection in connections:
            self.stdout.write(
                f"- {connection.id} | {connection.workspace.name} | "
                f"{connection.network} | {connection.display_name} | {connection.status}"
            )

        if not connection_count:
            self.stdout.write(self.style.SUCCESS("Nothing to delete."))
            return

        if not options["confirm"]:
            self.stdout.write(self.style.WARNING("Preview only; rerun with --confirm to delete these records."))
            return

        if publish_job_count and not options["delete_publish_history"]:
            raise CommandError(
                f"Deletion blocked: {publish_job_count} publish job(s) reference the selected connection(s). "
                "Rerun with --delete-publish-history only if that history may also be deleted."
            )

        with transaction.atomic():
            deleted_publish_jobs = 0
            if publish_job_count:
                deleted_publish_jobs, _ = PublishJob.objects.filter(connection_id__in=connection_ids).delete()
            deleted_connections, _ = SocialConnection.objects.filter(id__in=connection_ids).delete()

        self.stdout.write(
            self.style.SUCCESS(
                f"Deleted {connection_count} Upload Post connection(s). "
                f"Publish-history objects deleted: {deleted_publish_jobs}. "
                f"Total database objects deleted: {deleted_connections + deleted_publish_jobs}."
            )
        )
