import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth import authenticate, login, logout, get_user_model

User = get_user_model()

# 1. 註冊 API
@csrf_exempt
def register_view(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            email = data.get('email')
            password = data.get('password')
            nickname = data.get('nickname', '')
            phone = data.get('phone', '')

            if not email or not password:
                return JsonResponse({'message': '請填寫完整的 Email 與密碼'}, status=400)

            if User.objects.filter(email=email).exists():
                return JsonResponse({'message': '該 Email 已被註冊'}, status=400)

            user = User.objects.create_user(
                username=email,
                email=email,
                password=password
            )
            
            if hasattr(user, 'nickname'):
                user.nickname = nickname
            if hasattr(user, 'phone'):
                user.phone = phone
            user.save()

            return JsonResponse({'message': '註冊成功！'}, status=201)

        except Exception as e:
            return JsonResponse({'message': f'伺服器錯誤：{str(e)}'}, status=500)

    return JsonResponse({'message': '不支援的請求方式'}, status=405)


# 2. 登入 API
@csrf_exempt
@csrf_exempt
def login_view(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            print("前端傳過來的資料內容：", data)

            # 增加 identifier 解析 (兼容前端各種欄位命名)
            account = (
                data.get('identifier') or 
                data.get('account') or 
                data.get('email') or 
                data.get('username')
            )
            password = data.get('password')

            if not account or not password:
                return JsonResponse({'message': '請輸入帳號與密碼'}, status=400)

            User = get_user_model()
            
            # 優先以 Email 搜尋使用者，若無則以 username 搜尋
            user_obj = User.objects.filter(email=account).first() or User.objects.filter(username=account).first()
            
            if not user_obj:
                print(f"資料庫找不到帳號/Email 為 {account} 的使用者")
                return JsonResponse({'message': '帳號或密碼錯誤'}, status=400)

            # 使用找到的 user_obj.username 進行 Django authenticate 驗證
            user = authenticate(request, username=user_obj.username, password=password)

            if user is not None:
                if not user.is_active:
                    return JsonResponse({'message': '此帳號已被停用'}, status=403)
                
                login(request, user)
                return JsonResponse({
                    'message': '登入成功',
                    'user': {
                        'email': user.email,
                        'nickname': getattr(user, 'nickname', user.username),
                        'phone': getattr(user, 'phone', '')
                    }
                }, status=200)
            else:
                print(f"密碼比對失敗！帳號：{user_obj.username}")
                return JsonResponse({'message': '帳號或密碼錯誤'}, status=400)

        except Exception as e:
            print("Login error detail:", e)
            return JsonResponse({'message': f'伺服器錯誤：{str(e)}'}, status=500)

    return JsonResponse({'message': '不支援的請求方式'}, status=405)


# 3. 驗證登入狀態 API (/api/auth/me)
@csrf_exempt
def me_view(request):
    if request.user.is_authenticated:
        user = request.user
        return JsonResponse({
            'user': {
                'email': user.email,
                'nickname': getattr(user, 'nickname', user.username),
                'phone': getattr(user, 'phone', '')
            }
        })
    return JsonResponse({'user': None}, status=200)


# 4. 登出 API
@csrf_exempt
def logout_view(request):
    logout(request)
    return JsonResponse({'message': '已成功登出'})