import { BrowserRouter } from 'react-router-dom';
import { AppRouter } from './router/AppRouter';
import { DropZonePage } from "@/components/DropZone/DropZonePage";
import { DawPage } from "@/components/Daw/DawPage";
import { HomePage } from "@/components/Home/HomePage";
import { DefaultLayout } from "@/components/Layouts/DefaultLayout";

// View Components
export const DropZoneView = () => {
    return (
        <DefaultLayout>
            <DropZonePage />
        </DefaultLayout>
    );
};

export const DawView = () => {
    return (
        <DefaultLayout>
            <DawPage />
        </DefaultLayout>
    );
};

export const HomeView = () => {
    return (
        <DefaultLayout>
            <HomePage />
        </DefaultLayout>
    );
};

function App() {
  return (
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  );
}

export default App;
