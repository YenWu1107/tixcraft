from django.urls import path, re_path
from .views import register_view, login_view, me_view, logout_view

urlpatterns = [
    re_path(r'^register/?$', register_view, name='register'),
    re_path(r'^login/?$', login_view, name='login'),
    re_path(r'^me/?$', me_view, name='me'),
    re_path(r'^logout/?$', logout_view, name='logout'),
]