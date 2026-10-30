import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "用環境變數 ADMIN_EMAIL / ADMIN_PASSWORD 建立（或更新）雲端後台管理員，可重複執行"

    def handle(self, *args, **options):
        email = os.environ.get("ADMIN_EMAIL")
        password = os.environ.get("ADMIN_PASSWORD")
        if not email or not password:
            self.stdout.write("未設定 ADMIN_EMAIL / ADMIN_PASSWORD，略過建立管理員")
            return
        User = get_user_model()
        user, created = User.objects.get_or_create(
            email=email, defaults={"username": email, "nickname": "管理員"}
        )
        user.is_staff = user.is_superuser = user.is_active = True
        user.set_password(password)
        user.save()
        self.stdout.write(self.style.SUCCESS(f"{'建立' if created else '更新'}管理員：{email}"))
