import { StatsDisplay } from './components/StatsDisplay'
import { SearchInterface } from './components/SearchInterface'

function App() {
  return (
    <article>
      <section>
        <h1>Forest Desktop</h1>
        <p className="subtitle">Graph-native knowledge base</p>

        <StatsDisplay />

        <h2>Search</h2>
        <SearchInterface />
      </section>
    </article>
  )
}

export default App
