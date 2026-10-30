from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

# 開發用：一行指令建立示範帳號，組員 clone 專案後不用自己手動建立
#   python manage.py seed_demo
# ⚠️ 只能在開發環境使用，正式上線前請刪除這些帳號、改用強密碼。

DEMO_MEMBER = ("demo@tixcraft.test", "tixcraft2026", "示範會員", False)
DEMO_ADMIN = ("admin@tixcraft.test", "admin12345", "管理員", True)


class Command(BaseCommand):
    help = "建立示範會員與示範管理員（僅限開發環境）"

    def handle(self, *args, **options):
        User = get_user_model()
        for email, password, nickname, is_admin in (DEMO_MEMBER, DEMO_ADMIN):
            user, created = User.objects.get_or_create(
                email=email, defaults={"username": email, "nickname": nickname}
            )
            user.is_staff = is_admin
            user.is_superuser = is_admin
            user.is_active = True
            user.set_password(password)
            user.save()
            role = "管理員" if is_admin else "會員"
            self.stdout.write(self.style.SUCCESS(f"{'建立' if created else '更新'}{role}：{email} / {password}"))
