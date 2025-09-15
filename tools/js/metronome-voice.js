// Lightweight voice module that assumes MetronomeUI has created the DOM and exported APIs
(function(){
  if (window.MetronomeConfig && window.MetronomeConfig.voice !== 'mod') return;
  const voiceIndicator = document.getElementById('voice-indicator');
  const voiceStatusText = document.getElementById('voice-status-text');
  const microphoneToggle = document.getElementById('microphone-toggle');
  if (!voiceIndicator || !voiceStatusText || !microphoneToggle) return;

  const WAKE_TIMEOUT_MS = 7000;
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    voiceStatusText.textContent = 'Speech recognition not supported';
    voiceIndicator.style.display = 'none';
    return;
  }

  let isAwake = false;
  let wakeTimer = null;
  let recognizing = false;
  let recognition;

  function startWakeTimer(){
    clearTimeout(wakeTimer);
    wakeTimer = setTimeout(()=>{
      isAwake = false;
      voiceIndicator.classList.remove('awake');
      voiceIndicator.classList.add('listening');
      voiceStatusText.textContent = 'Waiting for command...';
    }, WAKE_TIMEOUT_MS);
  }

  function setState(state){
    voiceIndicator.classList.remove('active','awake','listening','detecting');
    if (state) voiceIndicator.classList.add(state);
  }

  function ensureRecognition(){
    if (recognition) return recognition;
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      recognizing = true;
      setState('listening');
      voiceStatusText.textContent = 'Waiting for command...';
    };

    recognition.onresult = (event) => {
      let interim = '', final = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const part = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += part; else interim += part;
      }
      const spoken = (final || interim).toLowerCase().replace(/[^a-z ]/g,'').trim();
      if (!spoken) return;

      if (!isAwake) {
        const isWake = (window.MetronomeUtils && window.MetronomeUtils.isWakeWord) ? window.MetronomeUtils.isWakeWord(spoken) : /\bhey\s+metronome\b/.test(spoken);
        if (isWake) {
          isAwake = true;
          setState('awake');
          voiceStatusText.textContent = 'Awake! Say a command...';
          startWakeTimer();
          return;
        }
        voiceStatusText.textContent = interim ? interim : 'Say "Hey Metronome"';
        return;
      }

      // Awakened: wait for a final command and process
      if (final) {
        clearTimeout(wakeTimer);
        const commandText = final;
        setState('active');
        voiceStatusText.textContent = 'Processing...';
        fetch('/api/parseMetronomeCommand', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: commandText }) })
          .then(r => r.json())
          .then(data => {
            if (data && data.command && window.MetronomeAPI) {
              const api = window.MetronomeAPI;
              try {
                switch(data.command){
                  case 'start': if (!api.isPlaying) api.start(); voiceStatusText.textContent = 'Metronome started'; break;
                  case 'stop': if (api.isPlaying) api.stop(); voiceStatusText.textContent = 'Metronome stopped'; break;
                  case 'set_tempo': if (data.params?.tempo!=null) { api.setTempo(data.params.tempo); voiceStatusText.textContent = `Tempo set to ${data.params.tempo} BPM`; } else voiceStatusText.textContent = 'Need a tempo number'; break;
                  case 'increase_tempo': { const cur = api.currentTempo; const next = Math.min(1000, cur + (data.params?.amount||5)); api.setTempo(next); voiceStatusText.textContent = `Tempo ${next} BPM`; break; }
                  case 'decrease_tempo': { const cur = api.currentTempo; const next = Math.max(10, cur - (data.params?.amount||5)); api.setTempo(next); voiceStatusText.textContent = `Tempo ${next} BPM`; break; }
                  case 'set_time_signature': if (data.params?.numerator && data.params?.denominator) { api.setBeatsPerMeasure(data.params.numerator); api.setNoteValue(data.params.denominator); voiceStatusText.textContent = `Time sig ${data.params.numerator}/${data.params.denominator}`; } else voiceStatusText.textContent = 'Invalid time signature'; break;
                  default: voiceStatusText.textContent = "Sorry, I didn't understand.";
                }
              } catch {
                voiceStatusText.textContent = 'Error performing command';
              }
            } else {
              voiceStatusText.textContent = "Sorry, I didn't understand.";
            }
          })
          .catch(()=>{ voiceStatusText.textContent = 'Network error'; })
          .finally(()=>{
            isAwake = false;
            setState('listening');
            startWakeTimer();
          });
      } else {
        voiceStatusText.textContent = interim || 'Yes?';
        startWakeTimer();
      }
    };

    recognition.onerror = (e) => {
      voiceStatusText.textContent = (e && e.error==='no-speech') ? 'Listening...' : 'Speech error';
      setState('listening');
    };

    recognition.onend = () => {
      recognizing = false;
      if (microphoneToggle.checked) {
        try { recognition.start(); } catch {}
      }
    };
    return recognition;
  }                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       

  function start(){ if (!recognizing) ensureRecognition().start(); }
  function stop(){ if (recognition) { try{ recognition.stop(); }catch{} recognizing=false; } }

  microphoneToggle.addEventListener('change', ()=>{
    if (microphoneToggle.checked) { setState('listening'); voiceStatusText.textContent='Waiting for command...'; start(); }
    else { stop(); setState(null); }
  });
})();
