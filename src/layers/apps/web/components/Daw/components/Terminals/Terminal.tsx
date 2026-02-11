import { useState } from 'react';
import { AgentTerminal } from './AgentTerminal/AgentTerminal';
import { CliTerminal } from './CliTerminal/CliTerminal';
import * as styles from './Terminal.css.ts';

type TerminalType = 'AGENT' | 'CLI';

export function Terminal() {
    const [activeTerminal, setActiveTerminal] = useState<TerminalType>('AGENT');

    const toggleTerminal = () => {
        setActiveTerminal(prev => (prev === 'AGENT' ? 'CLI' : 'AGENT'));
    };

    return (
        <div className={styles.container}>
            <div className={styles.content}>
                {activeTerminal === 'AGENT' ? (
                    <AgentTerminal />
                ) : (
                    <CliTerminal />
                )}
            </div>
            <div className={styles.footer}>
                <button 
                    className={styles.toggleButton} 
                    onClick={toggleTerminal}
                    title={`Switch to ${activeTerminal === 'AGENT' ? 'CLI' : 'Agent'}`}
                >
                    <span className={activeTerminal === 'AGENT' ? styles.activeIndicator : ''}>
                        AGENT
                    </span>
                    <span>/</span>
                    <span className={activeTerminal === 'CLI' ? styles.activeIndicator : ''}>
                        CLI
                    </span>
                </button>
            </div>
        </div>
    );
}
