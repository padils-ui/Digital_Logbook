'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Mic, Square, Sparkles, TriangleAlert } from 'lucide-react';
import type { LogCategory } from '@/lib/log-categories';

/** Peta tabKey (dihantar AI) → nilai kategori dalam borang. */
export const TAB_KEY_TO_CATEGORY: Record<string, LogCategory> = {
  aktiviti_anak: 'child_activity',
  pembelajaran: 'child_activity',
  aktiviti_luar: 'child_activity',
  makanan: 'meals',
  tidur: 'sleep',
  kehadiran_suhu: 'attendance',
  kesihatan_ubat: 'health',
};

export interface VoiceLogResult {
  /** Data yang dihalakan ke setiap tab: { [tabKey]: { field: value } }. */
  dataByTab: Record<string, Record<string, unknown>>;
  studentNames: string[];
  summary: string;
  confidence: number | null;
  /** Senarai kategori borang yang menerima data AI. */
  updatedCategories: LogCategory[];
}

interface VoiceRecorderProps {
  /** Dipanggil apabila Gemini memulangkan log berstruktur. */
  onResult: (result: VoiceLogResult) => void;
}

/** Jenis minimum Web Speech API (tidak lengkap dalam lib.dom). */
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      0: { transcript: string };
    };
  };
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Rakaman suara Bahasa Melayu dengan dua mod:
 *  1. Web Speech API — transkripsi langsung (Chrome/Edge/Android).
 *  2. MediaRecorder — hantar audio ke Gemini (fallback iOS Safari).
 */
export function VoiceRecorder({ onResult }: VoiceRecorderProps) {
  const [supported, setSupported] = useState<{
    speech: boolean;
    recorder: boolean;
  }>({ speech: false, recorder: false });
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const finalTranscriptRef = useRef('');
  // Elak pemprosesan berganda apabila onend mencetus selepas handleStop.
  const stoppedRef = useRef(false);

  useEffect(() => {
    setSupported({
      speech: getSpeechRecognition() !== null,
      recorder:
        typeof window !== 'undefined' &&
        typeof window.MediaRecorder !== 'undefined' &&
        !!navigator.mediaDevices?.getUserMedia,
    });
  }, []);

  const sendToGemini = useCallback(
    async (payload: { transcript?: string; audioBase64?: string; mimeType?: string }) => {
      setProcessing(true);
      setError(null);
      try {
        const res = await fetch('/api/voice-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          // Tunjukkan mesej mesra — bukan JSON mentah
          setError(
            data.error ??
              'Sistem AI mengalami kesibukan sementara. Sila isi borang secara manual atau cuba sebentar lagi.'
          );
          return;
        }
        // Jika sandaran kata kunci digunakan, tunjukkan amaran khusus
        if (data.fallback) {
          setSummary(
            data.summary ??
              'Sistem AI sibuk. Data diisi menggunakan penghurai sandaran — sila semak.'
          );
        } else {
          setSummary(data.summary ?? null);
        }

        // Bina peta dataByTab dan senarai kategori yang dikemas kini.
        const rawTabs = (data.dataByTab ?? {}) as Record<
          string,
          Record<string, unknown>
        >;
        const dataByTab: Record<string, Record<string, unknown>> = {};
        const updatedCategories: LogCategory[] = [];
        for (const [tabKey, fields] of Object.entries(rawTabs)) {
          const cat = TAB_KEY_TO_CATEGORY[tabKey];
          if (!cat || !fields || typeof fields !== 'object') continue;
          dataByTab[tabKey] = fields;
          if (!updatedCategories.includes(cat)) updatedCategories.push(cat);
        }

        onResult({
          dataByTab,
          studentNames: data.studentNames ?? [],
          summary: data.summary ?? '',
          confidence: data.confidence ?? null,
          updatedCategories,
        });
      } catch {
        setError('Ralat rangkaian. Sila semak sambungan anda.');
      } finally {
        setProcessing(false);
      }
    },
    [onResult]
  );

  /**
   * Hantar transkripsi terus daripada pemboleh ubah tempatan (bukan state React)
   * untuk mengelak masalah "stale closure" — state `transcript` masih kosong
   * semasa callback onresult/onend dijalankan.
   */
  const processTranscript = useCallback(
    async (capturedText: string) => {
      const text = capturedText.trim();
      if (!text) {
        setError('Tiada pertuturan dikesan. Sila cuba lagi.');
        return;
      }
      setTranscript(text);
      await sendToGemini({ transcript: text });
    },
    [sendToGemini]
  );

  const startSpeech = useCallback(() => {
    const Ctor = getSpeechRecognition();
    if (!Ctor) return false;

    const recognition = new Ctor();
    recognition.lang = 'ms-MY';
    recognition.continuous = true;
    recognition.interimResults = true;
    finalTranscriptRef.current = '';
    stoppedRef.current = false;
    setTranscript('');

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscriptRef.current += `${result[0].transcript} `;
        } else {
          interim += result[0].transcript;
        }
      }
      // Paparkan transkripsi langsung (termasuk interim) untuk maklum balas UI.
      setTranscript((finalTranscriptRef.current + interim).trim());
    };

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed') {
        setError('Kebenaran mikrofon ditolak. Sila benarkan akses mikrofon.');
      } else if (event.error !== 'aborted' && event.error !== 'no-speech') {
        setError(`Ralat pengecaman suara: ${event.error}`);
      }
      setRecording(false);
    };

    // Apabila pengecaman tamat (auto atau selepas stop), hantar transkripsi
    // TERUS daripada ref — bukan state React yang mungkin masih kosong.
    recognition.onend = () => {
      setRecording(false);
      if (stoppedRef.current) return; // handleStop sudah mengendalikannya
      stoppedRef.current = true;
      const captured = finalTranscriptRef.current.trim();
      if (captured) {
        void processTranscript(captured);
      } else {
        setError('Tiada pertuturan dikesan. Sila cuba lagi.');
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    return true;
  }, [processTranscript]);

  const startRecorder = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        const buffer = await blob.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(buffer).reduce(
            (acc, byte) => acc + String.fromCharCode(byte),
            ''
          )
        );
        await sendToGemini({
          audioBase64: base64,
          mimeType: blob.type,
        });
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      return true;
    } catch {
      setError('Tidak dapat mengakses mikrofon. Sila benarkan akses.');
      return false;
    }
  }, [sendToGemini]);

  const handleStart = useCallback(async () => {
    setError(null);
    setSummary(null);
    if (supported.speech) {
      const started = startSpeech();
      if (started) {
        setRecording(true);
        return;
      }
    }
    await startRecorder();
  }, [supported.speech, startSpeech, startRecorder]);

  const handleStop = useCallback(async () => {
    if (supported.speech && recognitionRef.current) {
      stoppedRef.current = true;
      recognitionRef.current.stop();
      recognitionRef.current = null;
      setRecording(false);
      // Ambil transkripsi TERUS daripada ref — bukan state React yang basi.
      const text = finalTranscriptRef.current.trim();
      if (!text) {
        setError('Tiada pertuturan dikesan. Sila cuba lagi.');
        return;
      }
      await processTranscript(text);
      return;
    }

    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
      setRecording(false);
    }
  }, [supported.speech, processTranscript]);

  const canUse = supported.speech || supported.recorder;

  return (
    <section className="card border-brand-200 bg-brand-50/50">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-brand-600" aria-hidden />
        <h2 className="text-sm font-semibold text-slate-800">
          Rakam Suara (AI)
        </h2>
      </div>
      <p className="mt-1 text-xs text-slate-600">
        Sebut log dalam Bahasa Melayu, contoh:{' '}
        <em>&ldquo;Aiman makan habis, kemudian tidur satu jam&rdquo;</em>. AI
        akan isi borang secara automatik.
      </p>

      {!canUse && (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          Pelayar ini tidak menyokong rakaman suara. Sila guna borang manual.
        </p>
      )}

      {canUse && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {!recording ? (
            <button
              type="button"
              onClick={handleStart}
              disabled={processing}
              className="btn-primary"
            >
              <Mic className="h-4 w-4" aria-hidden />
              Mula Rakam
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStop}
              className="btn bg-red-600 text-white hover:bg-red-700"
            >
              <Square className="h-4 w-4" aria-hidden />
              Hentikan
            </button>
          )}

          {recording && (
            <span className="flex items-center gap-2 text-xs font-medium text-red-600">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-600" />
              Merakam…
            </span>
          )}

          {processing && (
            <span className="flex items-center gap-2 text-xs font-medium text-brand-700">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Memproses dengan AI…
            </span>
          )}
        </div>
      )}

      {transcript && (
        <p className="mt-3 rounded-lg bg-white p-2 text-xs text-slate-700">
          <span className="font-semibold">Transkripsi: </span>
          {transcript}
        </p>
      )}

      {summary && (
        <p className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-800">
          <span className="font-semibold">AI: </span>
          {summary}
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700"
        >
          {error}
        </p>
      )}
    </section>
  );
}
