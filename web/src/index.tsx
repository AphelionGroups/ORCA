/* @refresh reload */
import { render } from 'solid-js/web'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from 'solid-js'
import { resetDemo } from './services/demoStorage'

const root = document.getElementById('root')

render(() => <ErrorBoundary fallback={(error) => <div class="demo-recovery" role="alert">
  <h1>Unable to open the demo</h1><p>{error.message}</p>
  <button class="btn-primary" onClick={() => { resetDemo(); window.location.reload(); }}>Reset demo</button>
</div>}><App /></ErrorBoundary>, root!)
