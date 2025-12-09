import { BrowserRouter } from 'react-router-dom';
import { DefaultLayout } from '@/components/Layouts/DefaultLayout';
import { AppRouter } from './router/AppRouter';

function App() {
  return (
    <DefaultLayout>
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
    </DefaultLayout>
  );
}

export default App;
