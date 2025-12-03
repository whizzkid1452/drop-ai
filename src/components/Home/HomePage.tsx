import { DropZonePage } from "@/components/DropZone/DropZonePage";
import * as styles from "./HomePage.css";

export function HomePage() {
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
                <DropZonePage />
                <div className={styles.waveAnimation} />
            </div>
        </>
    )
}