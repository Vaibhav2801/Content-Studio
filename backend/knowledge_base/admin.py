from django.contrib import admin
from django.contrib.admin import ModelAdmin
from .models import UserProfile

@admin.register(UserProfile)
class UserProfileAdmin(ModelAdmin):
    list_display = ('username', 'email', 'full_name', 'created_at')
    search_fields = ('username', 'email', 'full_name')
