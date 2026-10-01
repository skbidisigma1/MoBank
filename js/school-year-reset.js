document.addEventListener('DOMContentLoaded', () => {
  const sourceInput = document.getElementById('reset-source-year');
  const targetInput = document.getElementById('reset-target-year');
  const previewButton = document.getElementById('preview-class-period-reset');
  const executeButton = document.getElementById('run-class-period-reset');
  const statusElement = document.getElementById('class-period-reset-status');

  if (!sourceInput || !targetInput || !previewButton || !executeButton || !statusElement) return;

  let preview = null;
  let previewYearPair = null;
  let isRunning = false;

  const setStatus = (message, isError = false) => {
    statusElement.textContent = message;
    statusElement.classList.toggle('error-message', isError);
  };

  const setBusy = busy => {
    previewButton.disabled = busy;
    executeButton.disabled = busy || !preview;
    sourceInput.disabled = busy;
    targetInput.disabled = busy;
  };

  async function callResetApi(payload) {
    await window.auth0Promise;
    const token = await window.getToken();
    const response = await fetch('/api/resetClassPeriods', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'School-year reset request failed.');
    return result;
  }

  function years() {
    return {
      sourceYear: sourceInput.value.trim(),
      targetYear: targetInput.value.trim()
    };
  }

  function invalidatePreview() {
    if (!preview) return;
    preview = null;
    previewYearPair = null;
    executeButton.disabled = true;
    setStatus('The year pair changed. Preview it again before running the reset.');
  }

  sourceInput.addEventListener('input', invalidatePreview);
  targetInput.addEventListener('input', invalidatePreview);

  previewButton.addEventListener('click', async () => {
    const yearPair = years();
    preview = null;
    previewYearPair = null;
    setBusy(true);
    setStatus('Checking user profiles…');
    try {
      preview = await callResetApi({ ...yearPair, dryRun: true });
      if (preview.status === 'complete') {
        setStatus(`The reset for ${preview.targetYear} is already complete (${preview.resetUsers} profiles were reset).`);
        preview = null;
        return;
      }
      previewYearPair = yearPair;
      const progress = preview.status === 'running'
        ? ` This reset has already processed ${preview.processedUsers} profiles and can be resumed.`
        : '';
      const baselineNote = preview.requiresBaseline
        ? ` This is the first recorded rollover; verify that ${yearPair.sourceYear} is the current school year.`
        : '';
      setStatus(`${preview.usersToReset} profiles currently have a class period set.${progress}${baselineNote} Balances, instruments, themes, transactions, and orders will be preserved.`);
    } catch (error) {
      setStatus(error.message, true);
    } finally {
      setBusy(false);
    }
  });

  executeButton.addEventListener('click', async () => {
    if (!preview || isRunning || !previewYearPair) return;
    const yearPair = years();
    if (yearPair.sourceYear !== previewYearPair.sourceYear ||
        yearPair.targetYear !== previewYearPair.targetYear) {
      invalidatePreview();
      return;
    }
    const count = preview.usersToReset;
    const baselinePrompt = preview.requiresBaseline
      ? `This first rollover will record ${yearPair.sourceYear} as the current school year. Confirm that this is correct.\n\n`
      : '';
    const accepted = window.confirm(
      `${baselinePrompt}Reset class periods for the ${yearPair.targetYear} school-year rollover? The preview found ${count} assigned profiles. Other profile and account data will be preserved.`
    );
    if (!accepted) return;

    isRunning = true;
    setBusy(true);
    try {
      let result;
      do {
        result = await callResetApi({
          ...yearPair,
          confirm: true,
          initializeBaseline: preview.requiresBaseline === true
        });
        setStatus(`Reset progress: ${result.resetUsers} profiles updated; ${result.processedUsers} profiles scanned.`);
      } while (result.status === 'running');

      setStatus(`Reset complete. ${result.resetUsers} profiles had a class period cleared. Students will choose their new period when they return.`);
      preview = null;
      previewYearPair = null;
    } catch (error) {
      setStatus(`${error.message} Preview this same year pair again to resume if the reset is still in progress.`, true);
      preview = null;
      previewYearPair = null;
    } finally {
      isRunning = false;
      setBusy(false);
    }
  });
});
