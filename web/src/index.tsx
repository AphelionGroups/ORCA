/* @refresh reload */
import { render } from 'solid-js/web'
import './styles/theme.css'
import './index.css'
import './styles/workspace.css'
import './styles/interactions.css'
import App from './App.tsx'

const root = document.getElementById('root')

render(() => <App />, root!)
