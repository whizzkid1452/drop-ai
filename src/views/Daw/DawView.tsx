import { DawPage } from "@/components/Daw/DawPage";
import { DefaultLayout } from "@/components/Layouts/DefaultLayout";

export const DawView = () => {
    return (
        <DefaultLayout>
            <DawPage />
        </DefaultLayout>
    );
};

export default DawView;