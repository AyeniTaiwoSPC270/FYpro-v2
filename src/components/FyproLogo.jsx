import { useTheme } from '../context/ThemeContext'

export default function FyproLogo({ className, style, height, width }) {
  const { theme } = useTheme()
  const src = theme === 'light' ? '/fypro-logo-light.png' : '/fypro-logo-bg.png'
  return <img src={src} alt="FYPro" className={className} style={style} height={height} width={width} />
}
