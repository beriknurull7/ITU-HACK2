// Captures one local clip. It never serializes audio or transmits it.
const QVoice = (() => {
  let source = "",
    state = "idle",
    stream,
    recorder,
    timer,
    request = 0;
  let notify = () => {};
  function releaseStream() {
    clearTimeout(timer);
    stream?.getTracks().forEach((track) => track.stop());
    stream = undefined;
  }
  function clear() {
    request++;
    if (recorder?.state === "recording") recorder.stop();
    recorder = undefined;
    releaseStream();
    if (source) URL.revokeObjectURL(source);
    source = "";
    state = "idle";
  }
  function stop() {
    if (recorder?.state === "recording") recorder.stop();
  }
  async function record() {
    clear();
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      state = "voiceUnsupported";
      notify();
      return;
    }
    const current = request;
    state = "voiceWaiting";
    notify();
    try {
      const input = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (current !== request) {
        input.getTracks().forEach((track) => track.stop());
        return;
      }
      stream = input;
      recorder = new MediaRecorder(input);
      const parts = [];
      const started = performance.now();
      recorder.ondataavailable = (e) => {
        if (e.data.size) parts.push(e.data);
      };
      recorder.onstop = () => {
        if (current !== request) return;
        const type = recorder.mimeType;
        releaseStream();
        recorder = undefined;
        if (performance.now() - started < 250) state = "voiceShort";
        else if (parts.length) {
          source = URL.createObjectURL(new Blob(parts, { type }));
          state = "voiceReady";
        } else state = "voiceFailed";
        notify();
      };
      recorder.onerror = () => {
        if (current === request) {
          clear();
          state = "voiceFailed";
          notify();
        }
      };
      recorder.start();
      state = "voiceRecording";
      timer = setTimeout(stop, 45000);
      notify();
    } catch (error) {
      if (current !== request) return;
      clear();
      state = error.name === "NotAllowedError" ? "voiceDenied" : "voiceFailed";
      notify();
    }
  }
  function load(file) {
    if (!file) return;
    clear();
    if (
      !file.type.startsWith("audio/") ||
      file.size < 1 ||
      file.size > 8_000_000
    )
      state = "voiceFileError";
    else {
      source = URL.createObjectURL(file);
      state = "voiceReady";
    }
    notify();
  }
  return {
    record,
    stop,
    clear,
    load,
    state: () => state,
    source: () => source,
    onChange: (fn) => {
      notify = fn;
    },
  };
})();
