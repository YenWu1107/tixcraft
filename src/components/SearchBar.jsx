import { Fragment, useEffect, useRef, useState } from 'react'
import Icon from './Icon'
import { CATEGORIES, DATE_OPTIONS, REGION_OPTIONS } from '../data/events'
import styles from './SearchBar.module.css'

// 搜尋即篩選：搜尋框、類別、日期、地點整合成一條膠囊搜尋列
const FIELDS = [
  { key: 'cat', label: '類別', empty: '所有類別', options: CATEGORIES.map((c) => ({ value: c, label: c })) },
  { key: 'date', label: '日期', empty: '任何日期', options: DATE_OPTIONS, wide: true },
  { key: 'region', label: '地點', empty: '全台灣', options: REGION_OPTIONS },
]

export default function SearchBar({ values, onChange, onSubmit, variant = 'page' }) {
  const [open, setOpen] = useState(null)
  const formRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const close = (e) => {
      if (e.type === 'keydown' ? e.key === 'Escape' : !formRef.current?.contains(e.target)) setOpen(null)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])

  const pick = (key, value) => {
    onChange({ ...values, [key]: value })
    setOpen(null)
  }

  return (
    <form
      ref={formRef}
      role="search"
      aria-label="搜尋節目"
      className={`${styles.bar} ${styles[variant]}`}
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit?.(values)
      }}
    >
      <label className={styles.query}>
        <span className={styles.fieldLabel}>搜尋</span>
        <input
          type="text"
          placeholder="藝人、節目或場館名稱"
          value={values.q}
          onChange={(e) => onChange({ ...values, q: e.target.value })}
          className={styles.input}
        />
      </label>

      {FIELDS.map((field) => {
        const current = field.options.find((o) => o.value === values[field.key])
        return (
          <Fragment key={field.key}>
            <span aria-hidden="true" className={styles.divider} />
            <div className={`${styles.segmentWrap} ${field.wide && variant === 'page' ? styles.wide : ''}`}>
              <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={open === field.key}
                onClick={() => setOpen(open === field.key ? null : field.key)}
                className={`${styles.segment} ${current ? styles.segmentActive : ''} ${open === field.key ? styles.segmentOpen : ''}`}
              >
                <span className={styles.fieldLabel}>{field.label}</span>
                <span className={styles.fieldValue}>{current ? current.label : field.empty}</span>
              </button>

              {open === field.key && (
                <ul role="listbox" aria-label={field.label} className={styles.menu}>
                  {[{ value: '', label: field.empty }, ...field.options].map((o) => (
                    <li key={o.value || 'all'}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={(values[field.key] || '') === o.value}
                        onClick={() => pick(field.key, o.value)}
                        className={styles.option}
                      >
                        {o.label}
                        {(values[field.key] || '') === o.value && <Icon name="check" size={16} strokeWidth={2.2} />}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Fragment>
        )
      })}

      <button type="submit" aria-label="開始搜尋" className={styles.submit}>
        <Icon name="search" size={22} strokeWidth={2.2} />
      </button>
    </form>
  )
}
