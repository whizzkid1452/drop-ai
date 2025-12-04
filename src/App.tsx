import { BrowserRouter } from 'react-router-dom';
import { AppRouter } from './router/AppRouter';
import { TrackProvider } from './contexts/TrackContext';

function App() {
  return (
    <BrowserRouter>
      <TrackProvider>
        <AppRouter />
      </TrackProvider>
    </BrowserRouter>
  );
}

export default App;
