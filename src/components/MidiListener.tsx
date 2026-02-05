
import { useMidiNote } from "@/hooks/useMidi";
import { AudioService } from "@/core/audio/AudioService";
import { useEffect } from "react";
import { useMidi } from "@/hooks/useMidi";

export function MidiListener() {
    const { isEnabled, error } = useMidi();

    useEffect(() => {
        if (isEnabled) {
            console.log("MIDI Enabled");
        }
        if (error) {
            console.warn("MIDI Error:", error);
        }
    }, [isEnabled, error]);

    useMidiNote((note, velocity, isNoteOn) => {
        const audioService = AudioService.getInstance();
        if (isNoteOn) {
            console.log(`Note On: ${note} (vel: ${velocity})`);
            audioService.playNote(note, velocity);
        } else {
            console.log(`Note Off: ${note}`);
            audioService.stopNote(note);
        }
    });

    return null; // Headless component
}
