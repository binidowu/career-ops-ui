import ProfileSettingsForm from "@/components/settings/ProfileSettingsForm";
import { getProfile, getWorkspaceSignals } from "@/lib/api/career-ops";
import type { UserProfile } from "@/lib/types";

function createBlankProfile(): UserProfile {
  return {
    candidate: {
      fullName: "",
      email: "",
      location: "",
    },
    targetRoles: {
      primary: [],
      archetypes: [],
    },
    narrative: {
      headline: "",
      exitStory: "",
      superpowers: [],
      proofPoints: [],
    },
    compensation: {
      targetRange: "",
      currency: "",
      minimum: "",
    },
    location: {
      country: "",
      city: "",
      timezone: "",
    },
  };
}

export default async function SettingsPage() {
  const [profile, workspace] = await Promise.all([
    getProfile(),
    getWorkspaceSignals(),
  ]);
  const editableProfile = profile ?? createBlankProfile();

  return (
    <article className="app-page app-page--narrow">
      <header className="page-copy">
        <p className="eyebrow">Settings</p>
        <h1>Profile, narrative, and scoring defaults in one quiet place.</h1>
        <p className="lede">
          {profile
            ? "This route is constrained on purpose. It should feel closer to a carefully edited profile document than a control room, with clear sections and immediate save feedback."
            : "The profile source file does not exist yet, so this route stays honest about what is missing and where the source of truth should live."}
        </p>
      </header>

      <section className="settings-stack">
        <section className="detail-panel">
          <p className="section-label">Candidate profile</p>
          <h2>
            {profile ? profile.candidate.fullName || "Profile loaded" : "No profile file found"}
          </h2>
          {profile ? (
            <ul className="compact-list">
              <li>Email: {profile.candidate.email || "Not set"}</li>
              <li>Location: {profile.candidate.location || "Not set"}</li>
              <li>
                Primary roles:{" "}
                {profile.targetRoles.primary.length
                  ? profile.targetRoles.primary.join(", ")
                  : "Not set"}
              </li>
            </ul>
          ) : (
            <p>
              Create <code>{workspace.profilePath}</code> inside{" "}
              <code>{workspace.careerOpsPath}</code> from
              <code> config/profile.example.yml</code> and this page will render
              the structured profile immediately.
            </p>
          )}
        </section>

        <section className="detail-panel">
          <p className="section-label">Scoring preferences</p>
          <h2>Role targets and evaluation context</h2>
          <p>
            {profile
              ? `${profile.targetRoles.archetypes.length} archetype target${profile.targetRoles.archetypes.length === 1 ? "" : "s"} are currently defined for downstream evaluation and compare flows.`
              : "These settings will be sourced from the same profile YAML so the web UI and CLI stay aligned instead of drifting."}
          </p>
        </section>

        <ProfileSettingsForm
          hasExistingProfile={Boolean(profile)}
          initialProfile={editableProfile}
        />
      </section>
    </article>
  );
}
