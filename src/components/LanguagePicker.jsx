import { Languages } from 'lucide-react';

export default function LanguagePicker({ locale, onChange, t, className = '' }) {
  return (
    <label className={`language-picker ${className}`}>
      <Languages aria-hidden="true" className="h-4 w-4" />
      <span className="sr-only">{t('language.label')}</span>
      <select
        aria-label={t('language.label')}
        value={locale}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="en">EN</option>
        <option value="fr">FR</option>
      </select>
    </label>
  );
}
