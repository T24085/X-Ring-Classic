import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { adminAPI, competitionsAPI, scoresAPI } from '../services/api.firebase';
import { Users, Save, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const MAX_CARDS = 4;

const emptyCard = () => ({ score: '', xCount: '' });

const AdminEnterScore = () => {
  const queryClient = useQueryClient();
  const [competitionId, setCompetitionId] = useState('');
  const [competitorId, setCompetitorId] = useState('');
  const [category, setCategory] = useState('');
  const [cardCount, setCardCount] = useState(MAX_CARDS);
  const [cards, setCards] = useState(() => Array.from({ length: MAX_CARDS }, emptyCard));
  const [addUserId, setAddUserId] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');

  const { data: competitionsResp } = useQuery(
    ['admin-enter-score-competitions'],
    () => competitionsAPI.getAll().then((r) => r.data),
    { staleTime: 5 * 60 * 1000 }
  );

  const competitions = (competitionsResp?.competitions || []).filter(
    (c) => c.status === 'published' || c.status === 'active'
  );

  const { data: selectedComp } = useQuery(
    ['competition', competitionId],
    () => (competitionId ? competitionsAPI.getById(competitionId).then((r) => r.data?.competition) : null),
    { enabled: !!competitionId, staleTime: 2 * 60 * 1000 }
  );

  const participants = useMemo(() => selectedComp?.participants || [], [selectedComp]);
  const participantIds = useMemo(() => new Set(participants.map((p) => p.userId).filter(Boolean)), [participants]);
  const shotsPerCard = selectedComp?.shotsPerTarget || 25;
  const maxScorePerCard = shotsPerCard * 10;
  const maxXPerCard = shotsPerCard;

  const { data: usersResp } = useQuery(
    ['admin-user-list-for-registration'],
    () => adminAPI.getUsers({ limit: 2000 }),
    { staleTime: 2 * 60 * 1000, enabled: !!competitionId }
  );

  const availableShooters = useMemo(() => {
    const users = usersResp?.users || [];
    return users.filter((u) => {
      if (!u?.id) return false;
      if (participantIds.has(u.id)) return false;
      const role = u.role || 'user';
      return role !== 'admin' && role !== 'range_admin' && role !== 'sponsor';
    });
  }, [usersResp, participantIds]);

  useEffect(() => {
    setCompetitorId('');
    setAddUserId('');
    setCardCount(MAX_CARDS);
    setCards(Array.from({ length: MAX_CARDS }, emptyCard));
  }, [competitionId]);

  const updateCardField = (index, field, rawValue) => {
    const next = [...cards];
    if (rawValue === '') {
      next[index] = { ...next[index], [field]: '' };
      setCards(next);
      return;
    }

    const parsed = parseInt(rawValue, 10);
    if (Number.isNaN(parsed)) {
      return;
    }

    const bounded =
      field === 'score'
        ? Math.max(0, Math.min(maxScorePerCard, parsed))
        : Math.max(0, Math.min(maxXPerCard, parsed));

    next[index] = { ...next[index], [field]: bounded };
    setCards(next);
  };

  const activeCards = useMemo(() => cards.slice(0, cardCount), [cards, cardCount]);
  const enteredCards = useMemo(
    () => activeCards.filter((c) => c.score !== '' && c.score !== null && c.score !== undefined),
    [activeCards]
  );
  const totalAcrossCards = useMemo(
    () => enteredCards.reduce((sum, c) => sum + (parseInt(c.score, 10) || 0), 0),
    [enteredCards]
  );

  const registerMutation = useMutation(
    async ({ competitionId: targetCompetitionId, userId }) =>
      competitionsAPI.registerCompetitor(targetCompetitionId, userId),
    {
      onSuccess: async (result, variables) => {
        const wasAlreadyRegistered = !!result?.data?.alreadyRegistered;
        toast.success(wasAlreadyRegistered ? 'Shooter was already registered' : 'Shooter added to competition');
        await queryClient.invalidateQueries(['competition', variables.competitionId]);
        setCompetitorId(variables.userId);
        setAddUserId('');
      },
      onError: (error) => {
        toast.error(error?.message || 'Failed to add shooter');
      },
    }
  );

  const mutation = useMutation(
    async (payloads) => Promise.all(payloads.map((payload) => scoresAPI.submitOnBehalf(payload))),
    {
      onSuccess: (_, payloads) => {
        toast.success(`Submitted ${payloads.length} score card(s)`);
        queryClient.invalidateQueries(['competition-scores', competitionId]);
        setCards(Array.from({ length: MAX_CARDS }, emptyCard));
        setPhotoUrl('');
        setVideoUrl('');
        setCompetitorId('');
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || 'Failed to submit score');
      },
    }
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!competitionId) return toast.error('Choose a competition');
    if (!competitorId) return toast.error('Choose a competitor');
    if (!category) return toast.error('Please select a weapon category (22LR or Airgun 22cal)');

    if (enteredCards.length === 0) {
      return toast.error('Enter at least one card score.');
    }

    for (let i = 0; i < activeCards.length; i += 1) {
      const card = activeCards[i];
      if (card.score === '' || card.score === null || card.score === undefined) {
        continue;
      }

      const score = parseInt(card.score, 10);
      const xCount = card.xCount === '' || card.xCount === null || card.xCount === undefined ? 0 : parseInt(card.xCount, 10);

      if (!Number.isInteger(score) || score < 0 || score > maxScorePerCard) {
        return toast.error(`Card ${i + 1}: score must be between 0 and ${maxScorePerCard}.`);
      }

      if (!Number.isInteger(xCount) || xCount < 0 || xCount > maxXPerCard) {
        return toast.error(`Card ${i + 1}: X count must be between 0 and ${maxXPerCard}.`);
      }

      if (xCount > Math.floor(score / 10)) {
        return toast.error(`Card ${i + 1}: X count cannot exceed the number of 10s in score.`);
      }
    }

    const payloads = enteredCards.map((card) => {
      const score = parseInt(card.score, 10);
      const xCount = card.xCount === '' || card.xCount === null || card.xCount === undefined ? 0 : parseInt(card.xCount, 10);

      return {
        competitionId,
        competitorId,
        category,
        score,
        tiebreakerData: {
          xCount,
          perfectShots: xCount,
        },
        evidence: {
          ...(photoUrl ? { photoUrl } : {}),
          ...(videoUrl ? { videoUrl } : {}),
        },
      };
    });

    mutation.mutate(payloads);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white drop-shadow-lg">Enter Score (Admin)</h1>
          <p className="text-white drop-shadow-md">Enter card totals for a registered competitor. Up to 4 cards per submission.</p>
        </div>
        <CheckCircle className="w-8 h-8 text-green-500" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="bg-white rounded-lg shadow-sm border p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Competition</label>
              <select
                value={competitionId}
                onChange={(e) => setCompetitionId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select competition...</option>
                {competitions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                    {c.schedule?.competitionDate ? ` - ${new Date(c.schedule.competitionDate).toLocaleDateString()}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                <Users className="w-4 h-4 mr-1" /> Competitor (registered)
              </label>
              <select
                value={competitorId}
                onChange={(e) => setCompetitorId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
                disabled={!competitionId}
              >
                <option value="">Select competitor...</option>
                {participants.map((p) => (
                  <option key={p.userId} value={p.userId}>
                    {p.userName || p.username || p.userId}
                  </option>
                ))}
              </select>
              {!competitionId && <p className="text-xs text-gray-700 mt-1">Choose a competition to see registered participants.</p>}
              {competitionId && participants.length === 0 && (
                <p className="text-xs text-gray-500 mt-1">No registered participants found for this competition.</p>
              )}
              {competitionId && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-2">
                  <p className="text-xs font-medium text-gray-700">Shooter forgot to register?</p>
                  <div className="flex flex-col md:flex-row gap-2">
                    <select
                      value={addUserId}
                      onChange={(e) => setAddUserId(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      disabled={registerMutation.isLoading}
                    >
                      <option value="">Select shooter to add...</option>
                      {availableShooters.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.firstName || u.lastName
                            ? `${u.firstName || ''} ${u.lastName || ''}`.trim()
                            : (u.username || u.email || u.id)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        if (!competitionId) {
                          toast.error('Choose a competition first');
                          return;
                        }
                        if (!addUserId) {
                          toast.error('Select a shooter to add');
                          return;
                        }
                        registerMutation.mutate({ competitionId, userId: addUserId });
                      }}
                      disabled={registerMutation.isLoading || !addUserId}
                      className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                    >
                      {registerMutation.isLoading ? 'Adding...' : 'Add To Competition'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Weapon Category *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select category...</option>
                <option value="22LR">22LR</option>
                <option value="Airgun 22cal">Airgun 22cal</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Scorecards</h2>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-700">Cards</label>
              <select
                value={cardCount}
                onChange={(e) => setCardCount(parseInt(e.target.value, 10))}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
              >
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <p className="text-sm text-gray-700">
            Per card max: <strong>{maxScorePerCard}</strong> points and <strong>{maxXPerCard}X</strong>.
          </p>

          <div className="space-y-3">
            {activeCards.map((card, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end bg-gray-50 rounded-lg p-3">
                <div className="text-sm font-medium text-gray-800">Card {index + 1}</div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Total Score</label>
                  <input
                    type="number"
                    min="0"
                    max={maxScorePerCard}
                    step="1"
                    value={card.score}
                    onChange={(e) => updateCardField(index, 'score', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder={`0-${maxScorePerCard}`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">X Count</label>
                  <input
                    type="number"
                    min="0"
                    max={maxXPerCard}
                    step="1"
                    value={card.xCount}
                    onChange={(e) => updateCardField(index, 'xCount', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder={`0-${maxXPerCard}`}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold text-gray-900">Cards Entered:</span>
              <span className="text-xl font-bold text-blue-600">{enteredCards.length}</span>
            </div>
            <div className="flex justify-between items-center mt-2">
              <span className="text-lg font-semibold text-gray-900">Combined Total:</span>
              <span className="text-2xl font-bold text-blue-600">{totalAcrossCards}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Photo URL (optional)</label>
              <input
                type="url"
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="https://example.com/target.jpg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Video URL (optional)</label>
              <input
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="https://example.com/video.mp4"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={mutation.isLoading}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
          >
            {mutation.isLoading ? (
              'Submitting...'
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Submit Score(s)
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AdminEnterScore;
