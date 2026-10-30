import styles from './SiteFooter.module.css'

export default function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <span>Copyright © 2026 拓元售票系統 tixcraft. 保留所有權利。</span>
        <span className={styles.links}>
          <a href="#">服務條款</a>
          <a href="#">隱私權政策</a>
          <a href="#">聯絡客服</a>
          <a href="#">主辦單位合作</a>
        </span>
      </div>
    </footer>
  )
}
