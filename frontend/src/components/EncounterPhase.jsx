import React from 'react';
import FocusedInterview from './FocusedInterview';
import ObjectiveReview from './ObjectiveReview';

function EncounterPhase({
  sessionId,
  patientData,
  interviewSupports,
  initialProgress,
  coachEnabled = false,
  onNext,
  onCapture,
  onClock
}) {
  return (
    <FocusedInterview
      sessionId={sessionId}
      interviewSupports={interviewSupports}
      initialProgress={initialProgress}
      patientSex={patientData?.sex}
      coachEnabled={coachEnabled}
      objectiveReview={(
        <ObjectiveReview
          sessionId={sessionId}
          onCapture={onCapture}
          onClock={onClock}
        />
      )}
      onNext={onNext}
      onCapture={onCapture}
      onClock={onClock}
    />
  );
}

export default EncounterPhase;
