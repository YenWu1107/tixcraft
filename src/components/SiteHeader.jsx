import { Link, NavLink, useLocation } from 'react-router-dom'
import Icon from './Icon'
import { useAuth } from '../context/AuthContext'
import styles from './SiteHeader.module.css'

// 精簡導覽：只保留四個入口，語言與地區合併成一顆按鈕
export default function SiteHeader({ active = 'programs', showSearch = true }) {
  const { user, logout } = useAuth()
  const { pathname } = useLocation()
  const navClass = (key) => `${styles.navLink} ${active === key ? styles.navActive : ''}`

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link to="/" aria-label="tixcraft 首頁" className={styles.logo}>
          <span className={styles.logoMark}>tixcraft</span>
          <span className={styles.logoSub}>拓元售票</span>
        </Link>

        <nav aria-label="主要導覽" className={styles.nav}>
          <NavLink to="/search" className={navClass('programs')} aria-current={active === 'programs' ? 'page' : undefined}>
            節目
          </NavLink>
          <Link to="/#news" className={navClass('news')}>最新消息</Link>
          <a href="#" className={navClass('faq')}>常見問題</a>
          <a href="#" className={navClass('orders')} aria-current={active === 'orders' ? 'page' : undefined}>
            訂單查詢
          </a>
        </nav>

        <div className={styles.actions}>
          {showSearch && (
            <Link to="/search" aria-label="搜尋節目" className={styles.iconBtn}>
              <Icon name="search" size={18} />
            </Link>
          )}
          <button type="button" aria-label="語言與地區" className={styles.langBtn}>
            <Icon name="globe" size={15} />
            繁中 · TW
          </button>
          {user ? (
            <button type="button" aria-label={`登出：${user.nickname}`} className={styles.userBtn} onClick={logout}>
              <span aria-hidden="true" className={styles.avatar}>{user.nickname.slice(0, 1)}</span>
              {user.nickname}・登出
            </button>
          ) : (
            <Link to="/login" state={{ from: pathname }} className={styles.loginBtn}>
              <Icon name="user" size={15} />
              登入
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
