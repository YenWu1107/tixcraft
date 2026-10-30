from django.contrib import admin
from django.urls import include, path, re_path
from django.views.generic import TemplateView

admin.site.site_header = "tixcraft 拓元售票・管理後台"
admin.site.site_title = "tixcraft 後台"
admin.site.index_title = "會員與活動管理"

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("accounts.urls")),
    path("api/events/", include("events.urls")),
    # 其餘網址（/zone、/payment…）全部交給 React Router（需先 npm run build 產生 dist/）
    re_path(r"^(?!(api|admin|static)(/|$)).*$", TemplateView.as_view(template_name="index.html")),
]
