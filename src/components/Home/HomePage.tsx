import { FileUpload } from "@/components/Daw/components/FileUpload/FileUpload";
import type { AudioFile } from "@/components/Daw/components/FileUpload/components/types";
import { useTracks } from "@/contexts/TrackContext";
import * as styles from "./HomePage.css";

export function HomePage() {
    const { addTrack } = useTracks();

    const handleFileUploaded = (file: AudioFile) => {
        addTrack(file);
    };

    return(
        <>
            <div className={styles.container}>
                <div className={styles.backgroundGrid} />
                <div className={styles.glowEffect} />
                <div className={styles.content}>
                    <h1 className={styles.logo}>Drop.ai</h1>
                    <div className={styles.accentLine} />
                    <p className={styles.subtitle}>Browser-based audio editing tool</p>
                </div>
                <FileUpload onFileUploaded={handleFileUploaded} />
                <div className={styles.waveAnimation} />
            </div>
        </>
    )
}