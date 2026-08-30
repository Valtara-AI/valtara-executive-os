"use client";

import * as React from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ArticulationSession, ArticulationSessionType } from "@nyxor/shared";
import {
  listSessions,
  submitAudioSession,
  submitTextSession,
} from "@/lib/articulation-training-api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

const SESSION_TYPE_LABEL: Record<ArticulationSessionType, string> = {
  speech: "Speech",
  pitch: "Pitch",
  presentation: "Presentation",
  deal_close: "Deal-closing conversation",
};

const MAX_RECORDING_SECONDS = 5 * 60;

function ScoreBar({ label, score }: { label: string; score: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span>{score}/100</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-border">
        <div className="h-full bg-primary" style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

function FeedbackView({ session }: { session: ArticulationSession }) {
  const feedback = session.feedbackJson;
  return (
    <Card>
      <h2 className="font-display mb-4 text-lg font-semibold">Feedback</h2>
      <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <ScoreBar label="Clarity" score={feedback.clarityScore} />
        <ScoreBar label="Structure" score={feedback.structureScore} />
        <ScoreBar label="Persuasiveness" score={feedback.persuasivenessScore} />
        <ScoreBar label="Tone" score={feedback.toneScore} />
      </div>

      <p className="mb-4 text-sm">{feedback.overallFeedback}</p>

      {feedback.strengths.length > 0 && (
        <div className="mb-4">
          <h3 className="mb-1 text-sm font-medium">Strengths</h3>
          <ul className="list-inside list-disc text-sm text-muted-foreground">
            {feedback.strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {feedback.fillerPhrases.length > 0 && (
        <div className="mb-4">
          <h3 className="mb-1 text-sm font-medium">Filler/hedge language found</h3>
          <p className="text-sm text-muted-foreground">{feedback.fillerPhrases.join(", ")}</p>
        </div>
      )}

      {feedback.rewriteSuggestions.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium">Rewrite suggestions</h3>
          <ul className="flex flex-col gap-3">
            {feedback.rewriteSuggestions.map((r, i) => (
              <li key={i} className="text-sm">
                <p className="text-muted-foreground line-through">{r.original}</p>
                <p>{r.suggested}</p>
                <p className="text-xs text-muted-foreground">{r.reason}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

export default function ArticulationTrainingPage() {
  const { data: session } = useSession();
  const accessToken = session?.accessToken;
  const queryClient = useQueryClient();

  const [mode, setMode] = React.useState<"type" | "record">("type");
  const [sessionType, setSessionType] = React.useState<ArticulationSessionType>("pitch");
  const [inputText, setInputText] = React.useState("");
  const [result, setResult] = React.useState<ArticulationSession | null>(null);

  const [isRecording, setIsRecording] = React.useState(false);
  const [recordedSeconds, setRecordedSeconds] = React.useState(0);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const historyQuery = useQuery({
    queryKey: ["articulation-sessions"],
    queryFn: () => listSessions(accessToken!),
    enabled: Boolean(accessToken),
  });

  const textMutation = useMutation({
    mutationFn: () => submitTextSession(accessToken!, sessionType, inputText),
    onSuccess: (session) => {
      setResult(session);
      setInputText("");
      void queryClient.invalidateQueries({ queryKey: ["articulation-sessions"] });
    },
  });

  const audioMutation = useMutation({
    mutationFn: (blob: Blob) => submitAudioSession(accessToken!, sessionType, blob),
    onSuccess: (session) => {
      setResult(session);
      void queryClient.invalidateQueries({ queryKey: ["articulation-sessions"] });
    },
  });

  async function startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];
    recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
      audioMutation.mutate(blob);
    };
    recorder.start();
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
    setRecordedSeconds(0);
    timerRef.current = setInterval(() => {
      setRecordedSeconds((s) => {
        if (s + 1 >= MAX_RECORDING_SECONDS) {
          stopRecording();
        }
        return s + 1;
      });
    }, 1000);
  }

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  }

  const minutes = String(Math.floor(recordedSeconds / 60)).padStart(2, "0");
  const seconds = String(recordedSeconds % 60).padStart(2, "0");

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
            &larr; Dashboard
          </Link>
          <h1 className="font-display text-2xl font-semibold">Articulation training</h1>
        </div>
        <ThemeToggle />
      </header>

      <Card>
        <p className="mb-4 text-sm text-muted-foreground">
          Get direct, structured feedback on a speech, pitch, presentation, or deal-closing
          conversation - type it out, or record yourself and let us transcribe it.
        </p>

        <div className="mb-4 flex gap-4">
          <label className="text-sm">
            Type:{" "}
            <select
              className="rounded-md border border-border bg-background px-2 py-1 text-sm"
              value={sessionType}
              onChange={(e) => setSessionType(e.target.value as ArticulationSessionType)}
            >
              {Object.entries(SESSION_TYPE_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <div className="flex gap-1 rounded-md border border-border p-1">
            <button
              type="button"
              className={`rounded px-3 py-1 text-sm ${mode === "type" ? "bg-primary text-primary-foreground" : ""}`}
              onClick={() => setMode("type")}
            >
              Type
            </button>
            <button
              type="button"
              className={`rounded px-3 py-1 text-sm ${mode === "record" ? "bg-primary text-primary-foreground" : ""}`}
              onClick={() => setMode("record")}
            >
              Record
            </button>
          </div>
        </div>

        {mode === "type" ? (
          <>
            <textarea
              className="mb-3 min-h-40 w-full rounded-md border border-border bg-background p-3 text-sm"
              placeholder="Paste or type your speech, pitch, or talking points..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              maxLength={20_000}
            />
            <Button
              disabled={!inputText.trim() || textMutation.isPending}
              onClick={() => textMutation.mutate()}
            >
              {textMutation.isPending ? "Analyzing…" : "Get feedback"}
            </Button>
            {textMutation.isError && (
              <p className="mt-2 text-sm text-muted-foreground">
                Couldn&rsquo;t analyze that - {textMutation.error.message}
              </p>
            )}
          </>
        ) : (
          <div className="flex flex-col items-start gap-3">
            {!isRecording ? (
              <Button onClick={() => void startRecording()} disabled={audioMutation.isPending}>
                {audioMutation.isPending ? "Analyzing…" : "Start recording"}
              </Button>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">
                  Recording… {minutes}:{seconds} / {Math.floor(MAX_RECORDING_SECONDS / 60)}:00
                </span>
                <Button variant="outline" onClick={stopRecording}>
                  Stop and analyze
                </Button>
              </div>
            )}
            {audioMutation.isError && (
              <p className="text-sm text-muted-foreground">
                Couldn&rsquo;t analyze that recording - {audioMutation.error.message}
              </p>
            )}
          </div>
        )}
      </Card>

      {result && <FeedbackView session={result} />}

      {(historyQuery.data?.length ?? 0) > 0 && (
        <Card>
          <h2 className="font-display mb-3 text-lg font-semibold">History</h2>
          <ul className="flex flex-col gap-2">
            {historyQuery.data!.map((s) => (
              <li key={s.id} className="flex justify-between text-sm">
                <span>{SESSION_TYPE_LABEL[s.sessionType]}</span>
                <span className="text-muted-foreground">
                  Clarity {s.clarityScore} · Structure {s.structureScore} · Persuasiveness{" "}
                  {s.persuasivenessScore} · Tone {s.toneScore}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </main>
  );
}
