import ReactDOM from 'react-dom/client';
import App from './App';
import { applyTheme, getInitialThemePreference, resolveTheme } from './theme/themePreference';
import './brand.css';
import './styles.css';
import './epr.css';
import './technology.css';
import './remediation.css';
import './threat.css';
import './vendor.css';
import './external.css';
import './nova.css';
import './styles/theme.css';
import './theme-overrides.css';

applyTheme(resolveTheme(getInitialThemePreference()));

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(<App />);
