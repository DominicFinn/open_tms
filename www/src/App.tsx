import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Blog from './pages/Blog'
import BlogPost from './pages/BlogPost'
import Docs from './pages/Docs'
import Operations from './pages/features/Operations'
import Triage from './pages/features/Triage'
import Quality from './pages/features/Quality'
import Reports from './pages/features/Reports'
import Warehouse from './pages/features/Warehouse'
import AiAgents from './pages/features/AiAgents'
import Financial from './pages/features/Financial'
import Layout from './components/Layout'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/features/operations" element={<Operations />} />
        <Route path="/features/triage" element={<Triage />} />
        <Route path="/features/quality" element={<Quality />} />
        <Route path="/features/reports" element={<Reports />} />
        <Route path="/features/warehouse" element={<Warehouse />} />
        <Route path="/features/ai-agents" element={<AiAgents />} />
        <Route path="/features/financial" element={<Financial />} />
        <Route path="/blog" element={<Blog />} />
        <Route path="/blog/:slug" element={<BlogPost />} />
        <Route path="/docs" element={<Docs />} />
      </Route>
    </Routes>
  )
}
