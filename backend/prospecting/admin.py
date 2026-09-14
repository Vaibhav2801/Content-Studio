from django.contrib import admin
from unfold.admin import ModelAdmin

from .models import Workspace, WorkspaceMembership


@admin.register(Workspace)
class WorkspaceAdmin(ModelAdmin):
    list_display = ('name', 'created_at')
    search_fields = ('name',)


@admin.register(WorkspaceMembership)
class WorkspaceMembershipAdmin(ModelAdmin):
    list_display = ('user', 'workspace', 'role', 'is_active', 'updated_at')
    list_filter = ('role', 'is_active')
    search_fields = ('user__username', 'user__email', 'workspace__name')
