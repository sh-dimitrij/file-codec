import { mount } from './ui/renderer'
import './style.css'

const root = document.getElementById('app')
if (!root) throw new Error('#app not found')
mount(root)
