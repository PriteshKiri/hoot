# Requirements Document

## Introduction

Hoot is an open-source, real-time quiz and polling platform inspired by Kahoot and Mentimeter. It enables a host (admin/presenter) to create and run interactive quiz events where remote or in-person participants join via a short code or QR code, answer questions on their own devices, and compete on a live leaderboard. The platform supports real-time synchronization, session resilience, multiple question types, media attachments, analytics export, and theming — making it suitable for classrooms, team events, and public presentations.

## Glossary

- **Admin**: The authenticated user who creates, manages, and presents Events.
- **Participant**: An unauthenticated user who joins an Event session using a Join Code or QR Code.
- **Event**: A named collection of Questions created by an Admin, analogous to a quiz or poll deck.
- **Session**: A live, time-bounded instance of an Event that Participants join and interact with.
- **Question**: A single prompt within an Event, with one or more Answer Options and a configurable Time Limit.
- **Answer Option**: A selectable response choice attached to a Question.
- **Join Code**: A short alphanumeric code generated when an Event is published, used by Participants to enter a Session.
- **QR Code**: A scannable image encoding the join URL for a Session.
- **Presenter Screen**: The admin-facing display shown during a live Session, visible to the audience via projection or screen share.
- **Participant Screen**: The device-specific view rendered on a Participant's browser during a Session.
- **Leaderboard**: A ranked list of Participants ordered by cumulative score, displayed after each Question and at the end of a Session.
- **Score**: Points awarded to a Participant for a correct answer, calculated from correctness and response speed (maximum 1000 points per Question).
- **Time Limit**: The number of seconds a Participant has to answer a Question.
- **Draft**: The initial, non-live state of an Event before it is published.
- **Published**: The state of an Event that has a Join Code and QR Code and can be started as a Session.
- **Word Cloud**: A visual aggregation of open-text answers where more frequent words appear larger.
- **Rating Scale**: A Question type where Participants select a numeric value within a defined range.
- **Avatar**: An emoji chosen by a Participant to represent themselves in the Session.
- **Analytics**: Aggregated per-question and per-participant response data collected during a Session.
- **Theme**: A visual style (colors, fonts, background) applied to the Presenter Screen and Participant Screen.

---

## Requirements

### Requirement 1: Admin Authentication

**User Story:** As an Admin, I want to create an account and log in, so that I can securely manage my Events.

#### Acceptance Criteria

1. THE Authentication_Service SHALL allow an Admin to register with a unique email address and a password of at least 8 characters.
2. WHEN an Admin submits valid credentials, THE Authentication_Service SHALL issue a session token and redirect the Admin to the dashboard.
3. IF an Admin submits invalid credentials, THEN THE Authentication_Service SHALL return an error message without revealing which field is incorrect.
4. WHEN an Admin's session token expires, THE Authentication_Service SHALL redirect the Admin to the login page.
5. THE Authentication_Service SHALL support password reset via a time-limited link sent to the Admin's registered email address.
6. IF an Admin attempts to register with an email address already associated with an existing account, THEN THE Authentication_Service SHALL return an error message indicating the email is already in use.
7. THE Authentication_Service SHALL invalidate the session token upon explicit logout, preventing further authenticated requests with that token.

---

### Requirement 2: Event Management

**User Story:** As an Admin, I want to create and manage Events, so that I can organise quiz content before going live.

#### Acceptance Criteria

1. THE Event_Manager SHALL allow an Admin to create an Event with a unique title of 1 to 100 characters and an optional description of up to 500 characters.
2. THE Event_Manager SHALL create every new Event in Draft state.
3. WHILE an Event is in Draft state, THE Event_Manager SHALL allow the Admin to add, edit, reorder, and delete Questions within the Event.
4. IF an Admin attempts to create an Event with a title that duplicates an existing Event title owned by the same Admin, THEN THE Event_Manager SHALL display a validation error and prevent creation.
5. IF an Admin attempts to delete an Event that has no active Session, THEN THE Event_Manager SHALL permanently remove the Event and all associated Questions and Answer Options.
6. IF an Admin attempts to delete an Event that has an active Session, THEN THE Event_Manager SHALL return an error message and leave the Event unchanged.
7. THE Event_Manager SHALL display all Events owned by the authenticated Admin on the dashboard, ordered by creation date descending.

---

### Requirement 3: Question Authoring

**User Story:** As an Admin, I want to add questions with configurable answer types and time limits, so that I can build varied and engaging quizzes.

#### Acceptance Criteria

1. THE Question_Editor SHALL support the following Question types: single-select multiple choice, multi-select multiple choice, open text, rating scale, and image-based multiple choice.
2. WHEN an Admin creates a multiple-choice Question (single-select, multi-select, or image-based), THE Question_Editor SHALL allow between 2 and 4 Answer Options.
3. IF an Admin attempts to save a single-select or multi-select Question without at least one Answer Option marked as correct, THEN THE Question_Editor SHALL display a validation error and prevent saving.
4. THE Question_Editor SHALL allow the Admin to set a Time Limit per Question between 5 and 120 seconds, with a default of 20 seconds.
5. WHEN an Admin attaches an image to a Question, THE Question_Editor SHALL accept only files in JPEG, PNG, GIF, or WebP format with a maximum file size of 5 MB.
6. IF an Admin attaches an image file that exceeds 5 MB or is not in a supported format, THEN THE Question_Editor SHALL display a validation error indicating the reason and prevent the file from being attached.
7. WHEN an Admin saves a Question, THE Question_Editor SHALL require the question text to be between 1 and 255 characters, displaying a validation error and preventing saving if this condition is not met.
8. IF an Admin configures a rating-scale Question with a minimum value greater than or equal to the maximum value, THEN THE Question_Editor SHALL display a validation error and prevent saving, where both values must be within the range of 1 to 10 inclusive.

---

### Requirement 4: Event Publishing

**User Story:** As an Admin, I want to publish an Event, so that Participants can join using a shareable link, QR code, or short code.

#### Acceptance Criteria

1. WHEN an Admin publishes an Event, THE Event_Manager SHALL transition the Event from Draft to Published state.
2. WHEN an Event is published, THE Event_Manager SHALL generate a unique Join Code of 6 characters drawn from the set A–Z and 0–9, treated case-insensitively.
3. WHEN an Event is published, THE Event_Manager SHALL generate a QR Code that encodes the URL `hoot.com/join/{join_code}`.
4. WHEN an Event is published, THE Event_Manager SHALL display the Join Code, QR Code, and shareable URL to the Admin within 2 seconds of the publish action.
5. IF an Admin attempts to publish an Event with zero Questions, THEN THE Event_Manager SHALL return a validation error and keep the Event in Draft state.
6. IF an Admin unpublishes a Published Event that has no active Session, THEN THE Event_Manager SHALL return the Event to Draft state and invalidate the existing Join Code, QR Code, and shareable URL.
7. WHEN an Admin re-publishes a previously unpublished Event, THE Event_Manager SHALL generate a new Join Code, QR Code, and shareable URL, distinct from any previously issued codes for that Event.

---

### Requirement 5: Participant Join Flow

**User Story:** As a Participant, I want to join a Session using a code or QR code and set my display name and avatar, so that I can participate in the quiz.

#### Acceptance Criteria

1. WHEN a Participant submits a valid Join Code at `hoot.com/join`, THE Join_Service SHALL route the Participant to the correct Session lobby.
2. WHEN a Participant scans a valid QR Code, THE Join_Service SHALL route the Participant to the correct Session lobby within 3 seconds without requiring manual code entry.
3. THE Join_Service SHALL require the Participant to enter a display name of 1 to 30 characters, consisting of Unicode letters, digits, spaces, hyphens, or underscores, before entering the Session lobby.
4. THE Join_Service SHALL require the Participant to select one emoji from a predefined set of at least 20 options as their Avatar.
5. IF a Participant submits a Join Code that does not correspond to a Published Event, or corresponds to a Session that has already started, ended, or reached its maximum capacity of 150 Participants, THEN THE Join_Service SHALL display a descriptive error message indicating why the join attempt failed.
6. IF a Participant submits a display name that is already in use within the same Session, THEN THE Join_Service SHALL prompt the Participant to choose a different name.
7. WHERE the Admin has enabled anonymous participation mode for an Event, THE Join_Service SHALL auto-generate a unique display name and Avatar for the Participant, bypassing the name and avatar selection step.
8. IF a Participant scans a QR Code that is invalid, expired, or corresponds to a non-joinable Session, THEN THE Join_Service SHALL display a descriptive error message and provide a link to `hoot.com/join` for manual code entry.

---

### Requirement 6: Session Lobby

**User Story:** As an Admin, I want to see Participants joining in real time on the Presenter Screen, so that I know when to start the quiz.

#### Acceptance Criteria

1. WHILE a Session is in lobby state, THE Presenter_Screen SHALL display the Join Code, QR Code, and a live count of connected Participants.
2. WHEN a Participant joins the Session lobby, THE Presenter_Screen SHALL display the Participant's display name and Avatar within 1 second.
3. WHEN a Participant joins the Session lobby, THE Participant_Screen SHALL display a message indicating they are waiting for the Admin to start the Session, along with the Session title.
4. IF zero Participants are in the lobby, THEN THE Presenter_Screen SHALL disable the Start button and indicate that at least 1 Participant must join before the Session can begin.
5. WHEN at least 1 Participant is in the lobby, THE Presenter_Screen SHALL enable the Start button, allowing the Admin to begin the Session.
6. WHEN a Participant leaves or disconnects from the Session lobby, THE Presenter_Screen SHALL update the live Participant count and remove the Participant's display name and Avatar within 1 second.

---

### Requirement 7: Real-Time Synchronization

**User Story:** As a Participant, I want my screen to stay in sync with the Presenter Screen, so that I see questions and results at the same time as everyone else.

#### Acceptance Criteria

1. THE Sync_Service SHALL propagate state transitions (lobby → question → results → leaderboard → ended) from the Admin to all connected Participants within 500 milliseconds, measured on a network with round-trip latency of 200 ms or less.
2. WHEN the Admin advances to the next Question, THE Sync_Service SHALL update all Participant Screens to display the new Question within 500 milliseconds of the Admin action.
3. WHEN the Time Limit for a Question expires, THE Sync_Service SHALL lock answer submission on all Participant Screens within 500 milliseconds of the expiry event.
4. THE Sync_Service SHALL use persistent bidirectional connections (e.g., WebSockets) to maintain real-time communication between the server and all clients.
5. WHEN a Participant reconnects to an active Session after a connection interruption, THE Sync_Service SHALL deliver the current Session state to the reconnected Participant within 2 seconds of reconnection.

---

### Requirement 8: Session Management and Reconnection

**User Story:** As a Participant, I want to rejoin a Session if I get disconnected, so that I don't lose my progress.

#### Acceptance Criteria

1. WHEN a Participant's connection is interrupted, THE Session_Manager SHALL preserve the Participant's accumulated score, per-question answer history, and current Session screen state for a reconnection window of at least 60 seconds.
2. WHEN a disconnected Participant reconnects within the reconnection window using the same display name and Join Code, THE Session_Manager SHALL restore the Participant's accumulated score, per-question answer history, and current Session screen state.
3. WHEN a Participant reconnects during an active Question and had not yet answered before disconnecting, THE Session_Manager SHALL display the Question with the remaining Time Limit.
4. WHEN a Participant reconnects during an active Question and had already submitted an answer before disconnecting, THE Session_Manager SHALL display the Question in a locked state showing the Participant's prior answer, with no option to resubmit.
5. IF a Participant's reconnection window expires, THEN THE Session_Manager SHALL remove the Participant's record from the active Session and from the Leaderboard.
6. IF a new Participant has claimed the disconnected Participant's display name during the reconnection window, THEN THE Session_Manager SHALL reject the reconnection attempt and display an error indicating the name conflict.

---

### Requirement 9: Quiz Flow — Question Display

**User Story:** As a Participant, I want to see each question clearly on my device with a countdown timer, so that I can answer within the time limit.

#### Acceptance Criteria

1. WHEN the Admin starts the Session, THE Presenter_Screen and THE Participant_Screen SHALL both display a 3-2-1 countdown animation before the first Question is shown.
2. WHEN a Question begins, THE Presenter_Screen and THE Participant_Screen SHALL simultaneously display the question text, Answer Options, and a countdown timer showing the remaining Time Limit.
3. WHILE a Question is active, THE Participant_Screen SHALL display Answer Options as tappable buttons.
4. WHEN a Participant selects an answer for a single-select Question, THE Participant_Screen SHALL immediately submit the answer and disable further selection for that Question.
5. WHEN a Participant selects answers for a multi-select Question, THE Participant_Screen SHALL allow multiple selections and deselections; the Participant must select at least 1 option to enable the submit button, and the answer is finalised only upon explicit submission.
6. WHEN a multi-select Question's Time Limit expires and the Participant has selected at least 1 option but has not submitted, THE Participant_Screen SHALL automatically submit the currently selected options and disable further interaction.
7. WHEN a Question's Time Limit expires and the Participant has not selected any option, THE Participant_Screen SHALL disable answer submission, record no answer for that Question, and display a "Time's up" indicator.
8. WHERE a Question includes an image attachment, THE Participant_Screen SHALL display the image above the question text.

---

### Requirement 10: Scoring

**User Story:** As a Participant, I want to earn points based on correctness and speed, so that I am rewarded for both accuracy and quick thinking.

#### Acceptance Criteria

1. IF a Participant submits an incorrect answer, THEN THE Scoring_Engine SHALL award 0 points for that Question.
2. WHEN a Participant submits a correct answer, THE Scoring_Engine SHALL award `max(1, floor(1000 × (remaining_time / time_limit)))` points, ensuring a minimum of 1 point for any correct answer regardless of remaining time.
3. WHEN a Participant does not submit an answer before the Time Limit expires, THE Scoring_Engine SHALL award 0 points for that Question.
4. IF a Participant submits multiple responses for the same Question (e.g., due to reconnection), THEN THE Scoring_Engine SHALL score only the first received submission and discard subsequent ones.
5. THE Scoring_Engine SHALL accumulate scores across all Questions after each Question is scored to produce a Participant's running total Session score.
6. THE Scoring_Engine SHALL maintain the invariant that the sum of a Participant's per-question scores equals the Participant's total Session score at all times.

---

### Requirement 11: Post-Question Results and Leaderboard

**User Story:** As a Participant and Admin, I want to see results and rankings after each question, so that the competition stays engaging.

#### Acceptance Criteria

1. WHEN a Question's Time Limit expires, THE Results_View SHALL display the correct answer(s) on the Presenter Screen.
2. WHEN all Participants have answered before the Time Limit expires, THE Results_View SHALL immediately display the correct answer(s) and the distribution of Participant responses (as both percentage and count per Answer Option) on the Presenter Screen without waiting for the timer to reach zero.
3. WHEN the Admin advances past the Results View, THE Leaderboard SHALL display the top 10 Participants ranked by cumulative score with animated transitions completing within 500 milliseconds.
4. WHEN scores change between Questions, THE Leaderboard SHALL update rank positions with animation completing within 500 milliseconds.
5. WHEN two or more Participants have equal cumulative scores on the Leaderboard, THE Leaderboard SHALL rank them in ascending alphabetical order of their display names.
6. WHEN the Admin advances past the Leaderboard, THE Sync_Service SHALL transition all Participant Screens to the next Question or the Final Leaderboard.

---

### Requirement 12: Final Leaderboard

**User Story:** As an Admin, I want to show a final leaderboard at the end of the quiz, so that winners are celebrated.

#### Acceptance Criteria

1. WHEN the last Question's results have been shown and the Admin advances to the Final Leaderboard, THE Final_Leaderboard SHALL display the top 3 Participants (or all Participants if fewer than 3 competed) with a confetti animation lasting no longer than 5 seconds.
2. WHEN the Final_Leaderboard is shown, THE Final_Leaderboard SHALL display all Participants ranked by total Session score in descending order; Participants with equal scores SHALL be ranked in ascending alphabetical order of their display names.
3. WHEN the Admin ends the Session, THE Session_Manager SHALL transition the Session to Ended state and disconnect all Participants.
4. WHEN a Session transitions to Ended state, THE Participant_Screen SHALL display a thank-you message and the Participant's final rank and score.

---

### Requirement 13: Analytics and Results Export

**User Story:** As an Admin, I want to view and export quiz results after the event, so that I can analyse participation and performance.

#### Acceptance Criteria

1. WHEN a Session transitions to Ended state, THE Analytics_Service SHALL persist per-question response data and per-participant scores.
2. WHEN an Admin views the analytics summary for a Session, THE Analytics_Service SHALL display, for each Question: the number of responses, the percentage and count selecting each Answer Option, and the average response time in seconds.
3. WHEN an Admin requests a CSV export for a Session, THE Analytics_Service SHALL generate and download a CSV file containing each Participant's display name, score per question (0 for unanswered questions), and total score.
4. THE Analytics_Service SHALL retain Session analytics data for at least 90 days after the Session ends, after which the data may become inaccessible.

---

### Requirement 14: Additional Question Types — Open Text and Word Cloud

**User Story:** As an Admin, I want to use open-text questions with word cloud visualisation, so that I can gather qualitative responses.

#### Acceptance Criteria

1. WHEN an Admin creates an open-text Question, THE Question_Editor SHALL not require Answer Options or a correct answer to be specified.
2. WHEN Participants submit open-text responses, THE Word_Cloud_Renderer SHALL aggregate the responses and display a word cloud on the Presenter Screen, updating in real time as new responses arrive.
3. THE Word_Cloud_Renderer SHALL scale word size proportionally to submission frequency, so that more frequently submitted words appear visually larger.
4. THE Scoring_Engine SHALL award 0 points for open-text Questions, as correctness cannot be automatically determined.
5. THE Question_Editor SHALL enforce a maximum response length of 200 characters for open-text Questions, displaying a validation error if the limit is exceeded.

---

### Requirement 15: Theming and Branding

**User Story:** As an Admin, I want to customise the visual theme of my Event, so that it matches my organisation's branding.

#### Acceptance Criteria

1. WHEN an Admin selects a theme for an Event, THE Theme_Manager SHALL provide at least 5 built-in colour themes to choose from.
2. WHERE an Admin has configured a custom theme, THE Presenter_Screen and THE Participant_Screen SHALL apply the custom primary colour, background colour, and font selection from a predefined list of at least 3 font options.
3. WHERE no custom theme has been configured for an Event, THE Theme_Manager SHALL apply the default built-in theme to the Presenter Screen, Participant Screen, and Join Page.
4. WHERE an Admin has uploaded a logo image (JPEG, PNG, or SVG, maximum 2 MB), THE Presenter_Screen, THE Participant_Screen, and THE Join_Page SHALL display the logo in the header area.
5. IF an Admin uploads a logo image that exceeds 2 MB or is not in a supported format, THEN THE Theme_Manager SHALL display a validation error indicating the reason and leave the existing logo unchanged.
6. THE Theme_Manager SHALL apply the selected theme's primary colour, background colour, and font consistently across the Presenter Screen, Participant Screen, and Join Page for the same Event.

---

### Requirement 16: Mobile-Responsive Design

**User Story:** As a Participant, I want to use Hoot on my phone without installing an app, so that I can join from any device.

#### Acceptance Criteria

1. THE Participant_Screen SHALL render without a horizontal scrollbar, without clipped content, and without overlapping elements at viewport widths from 320 px to 2560 px.
2. THE Participant_Screen SHALL display Answer Option buttons with a minimum touch target size of 44 × 44 CSS pixels on viewports 768 px wide or narrower.
3. THE Join_Service SHALL allow Participants to join a Session and submit answers without requiring installation of a native application.
4. THE Participant_Screen SHALL achieve a Lighthouse mobile performance score of at least 80 using Lighthouse's default mobile preset (simulated 4G throttling, Moto G4 device emulation).
