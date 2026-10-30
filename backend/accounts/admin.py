from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User


@admin.register(User)
class MemberAdmin(UserAdmin):
    list_display = ("email", "nickname", "phone", "is_active", "date_joined")
    search_fields = ("email", "nickname", "phone")
    fieldsets = UserAdmin.fieldsets + (("會員資料", {"fields": ("nickname", "phone")}),)
    add_fieldsets = UserAdmin.add_fieldsets + (("會員資料", {"fields": ("email", "nickname", "phone")}),)
