import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { competitionsAPI, scoresAPI, usersAPI } from '../services/api';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useForm } from 'react-hook-form';
import { Upload, Target, Camera, FileText, Save, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const ScoreSubmission = () => {
  const { competitionId } = useParams();
  const { user } = useAuth();
  const [selectedCompetition, setSelectedCompetition] = useState('');
  const [shotScores, setShotScores] = useState(Array(10).fill({ value: '', isX: false }));
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [photoUrl, setPhotoUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const queryClient = useQueryClient();

  const { register, handleSubmit, formState: { errors }, reset, watch, setValue } = useForm();

  // Fetch competitions for dropdown
  // Load competitions list (we'll filter client-side)
  const { data: competitions } = useQuery(
    'competitions',
    async () => {
      const resp = await competitionsAPI.getAll();
      return resp.data;
    },
    { staleTime: 5 * 60 * 1000 }
  );

  // Load user registered competitions to restrict to eligible events
  const { data: userComps } = useQuery(
    ['user-competitions', user?.id],
    async () => {
      if (!user?.id) return null;
      const resp = await usersAPI.getCompetitions(user.id);
      return resp.data;
    },
    { enabled: !!user?.id, staleTime: 2 * 60 * 1000 }
  );

  useEffect(() => {
    if (competitionId) {
      setSelectedCompetition(competitionId);
    }
  }, [competitionId]);

  const availableCompetitions = ((userComps?.registered && userComps.registered.length > 0)
    ? userComps.registered
    : (competitions?.competitions || [])
  ).filter((comp) => ['published', 'active'].includes(comp.status));

  useEffect(() => {
    if (!selectedCompetition && availableCompetitions.length === 1) {
      setSelectedCompetition(availableCompetitions[0].id);
    }
  }, [availableCompetitions, selectedCompetition]);

  // Load selected competition details to determine required shots
  const { data: selectedComp } = useQuery(
    ['competition', selectedCompetition],
    async () => {
      if (!selectedCompetition) return null;
      const resp = await competitionsAPI.getById(selectedCompetition);
      return resp.data?.competition || null;
    },
    { enabled: !!selectedCompetition, staleTime: 2 * 60 * 1000 }
  );

  // Sync shot count with competition requirement
  useEffect(() => {
    const required = selectedComp?.shotsPerTarget || 10;
    if (required && shotScores.length !== required) {
      setShotScores(Array(required).fill({ value: '', isX: false }));
    }
  }, [selectedComp]);

  // Auto-populate competition date when a competition is selected/loaded
  useEffect(() => {
    const rawDate = selectedComp?.schedule?.competitionDate || selectedComp?.startDate;

    const toInputDate = (d) => {
      if (!d) return '';
      try {
        let ms;
        if (typeof d === 'object' && d.seconds) {
          ms = d.seconds * 1000; // Firestore Timestamp
        } else if (typeof d === 'number') {
          ms = d;
        } else {
          ms = Date.parse(d);
        }
        if (Number.isNaN(ms)) return '';
        const dt = new Date(ms);
        const yyyy = dt.getFullYear();
        const mm = String(dt.getMonth() + 1).padStart(2, '0');
        const dd = String(dt.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      } catch (_) {
        return '';
      }
    };

    const inputDate = toInputDate(rawDate);
    setValue('competitionDate', inputDate);
  }, [selectedComp, setValue]);

  // Score submission mutation
  const submitScoreMutation = useMutation(
    (scoreData) => scoresAPI.submit(scoreData),
    {
      onSuccess: () => {
        toast.success('Score submitted successfully!');
        reset();
        setShotScores(Array(10).fill({ value: '', isX: false }));
        setUploadedFiles([]);
        queryClient.invalidateQueries('scores');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to submit score');
      },
    }
  );

  const handleShotValueChange = (index, value) => {
    const newScores = [...shotScores];
    const intVal = value === '' ? '' : Math.max(0, Math.min(10, parseInt(value, 10) || 0));
    newScores[index] = { value: intVal, isX: intVal === 10 ? newScores[index]?.isX || false : false };
    setShotScores(newScores);
  };

  const handleShotXToggle = (index, checked) => {
    const newScores = [...shotScores];
    const current = newScores[index] || { value: '', isX: false };
    if (checked) {
      // Selecting X should automatically set value to 10
      newScores[index] = { value: 10, isX: true };
    } else {
      newScores[index] = { value: current.value, isX: false };
    }
    setShotScores(newScores);
  };

  const handleFileUpload = (event) => {
    const files = Array.from(event.target.files);
    const newFiles = files.map(file => ({
      id: Date.now() + Math.random(),
      file,
      type: file.type.startsWith('image/') ? 'image' : 'video',
      preview: URL.createObjectURL(file)
    }));
    setUploadedFiles(prev => [...prev, ...newFiles]);
  };

  const removeFile = (fileId) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const calculateTotalScore = () => {
    return shotScores.reduce((total, shot) => total + (parseInt(shot.value, 10) || 0), 0);
  };

  const calculateXCount = () => {
    return shotScores.filter((s) => parseInt(s.value, 10) === 10 && s.isX).length;
  };

  const onSubmit = (data) => {
    if (!selectedCompetition) {
      toast.error('Please select a competition');
      return;
    }

    const totalScore = calculateTotalScore();
    const requiredShots = selectedComp?.shotsPerTarget || 10;
    const filledShots = shotScores.filter((v) => v && v.value !== '' && v.value !== null && v.value !== undefined);
    if (filledShots.length !== requiredShots) {
      toast.error(`This competition requires ${requiredShots} shots. You entered ${filledShots.length}.`);
      return;
    }
    if (totalScore === 0) {
      toast.error('Please enter at least one shot score');
      return;
    }

    // Evidence URLs are optional; range officers will verify

    const payload = {
      competitionId: selectedCompetition,
      score: Math.round(totalScore),
      shots: shotScores
        .map((s) => ({ value: parseInt((s?.value ?? '0'), 10) || 0, isX: s?.isX === true }))
        .filter((s) => Number.isInteger(s.value))
        .slice(0, requiredShots),
      equipment: {
        rifle: data.rifle,
        scope: data.scope,
        ammunition: data.ammunition,
        rest: data.rest
      },
      conditions: {
        weather: data.weather,
        temperature: data.temperature,
        wind: data.wind,
        notes: data.notes
      },
      evidence: {
        ...(photoUrl ? { photoUrl } : {}),
        ...(videoUrl ? { videoUrl } : {})
      }
    };

    submitScoreMutation.mutate(payload);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Submit Score</h1>
        <p className="text-gray-600">Submit your competition score with verification</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Competition Selection */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <Target className="h-5 w-5 mr-2" />
            Competition Details
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Competition *
              </label>
              <select
                value={selectedCompetition}
                onChange={(e) => setSelectedCompetition(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">Choose a competition...</option>
                {availableCompetitions.map((comp) => (
                  <option key={comp.id} value={comp.id}>
                    {comp.title} - {
                      comp.schedule?.competitionDate
                        ? new Date(comp.schedule.competitionDate).toLocaleDateString()
                        : comp.startDate
                        ? new Date(comp.startDate).toLocaleDateString()
                        : 'TBD'
                    }
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date of Competition
              </label>
              <input
                type="date"
                {...register('competitionDate')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Evidence URLs (optional) */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Evidence Links (optional)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Photo URL (optional)</label>
              <input
                type="url"
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                placeholder="https://example.com/target.jpg"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Video URL (optional)</label>
              <input
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://example.com/video.mp4"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">Optional: add links to photos or videos for quicker verification.</p>
        </div>

        {/* Shot-by-Shot Scoring */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <Target className="h-5 w-5 mr-2" />
            Shot-by-Shot Scoring
          </h2>
          <p className="text-sm text-gray-600 mb-3">
            Required shots for this competition: {selectedComp?.shotsPerTarget || 10}
          </p>
          
          <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-10 gap-3 mb-4">
            {shotScores.map((shot, index) => (
              <div key={index} className="text-center">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Shot {index + 1}
                </label>
                <div className="flex flex-col items-center gap-1 sm:flex-row sm:gap-2 sm:justify-center">
                  <select
                    value={shot.value}
                    onChange={(e) => handleShotValueChange(index, e.target.value)}
                    className="w-14 sm:w-16 px-2 py-1 text-center border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">--</option>
                    {Array.from({ length: 11 }, (_, i) => i).map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                  <label className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={!!shot.isX}
                      onChange={(e) => handleShotXToggle(index, e.target.checked)}
                    />
                    <span>X</span>
                  </label>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold text-gray-900">Total Score:</span>
              <span className="text-2xl font-bold text-blue-600">{calculateTotalScore()} ({calculateXCount()}X)</span>
            </div>
          </div>
        </div>

        {/* Equipment Information */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <FileText className="h-5 w-5 mr-2" />
            Equipment Information
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rifle Model
              </label>
              <input
                type="text"
                {...register('rifle')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Ruger 10/22"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Scope/Optics
              </label>
              <input
                type="text"
                {...register('scope')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Leupold VX-3i 3-9x40"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ammunition
              </label>
              <input
                type="text"
                {...register('ammunition')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., CCI Standard Velocity"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rest/Support
              </label>
              <input
                type="text"
                {...register('rest')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Caldwell Lead Sled"
              />
            </div>
          </div>
        </div>

        {/* Shooting Conditions */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <FileText className="h-5 w-5 mr-2" />
            Shooting Conditions
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Weather
              </label>
              <select
                {...register('weather')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select weather...</option>
                <option value="sunny">Sunny</option>
                <option value="cloudy">Cloudy</option>
                <option value="rainy">Rainy</option>
                <option value="windy">Windy</option>
                <option value="indoor">Indoor</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Temperature (°F)
              </label>
              <input
                type="number"
                {...register('temperature')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="72"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Wind Speed (mph)
              </label>
              <input
                type="number"
                {...register('wind')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="5"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Additional Notes
            </label>
            <textarea
              {...register('notes')}
              rows="3"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Any additional notes about shooting conditions, equipment setup, etc."
            />
          </div>
        </div>

        {/* Evidence Upload */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <Camera className="h-5 w-5 mr-2" />
            Evidence Upload
          </h2>
          
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">
              Upload photos or videos of your target, setup, or shooting process
            </p>
            <input
              type="file"
              multiple
              accept="image/*,video/*"
              onChange={handleFileUpload}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors"
            >
              Choose Files
            </label>
          </div>

          {/* Uploaded Files Preview */}
          {uploadedFiles.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Uploaded Files</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {uploadedFiles.map((fileObj) => (
                  <div key={fileObj.id} className="relative">
                    {fileObj.type === 'image' ? (
                      <img
                        src={fileObj.preview}
                        alt="Uploaded evidence"
                        className="w-full h-24 object-cover rounded-lg"
                      />
                    ) : (
                      <video
                        src={fileObj.preview}
                        className="w-full h-24 object-cover rounded-lg"
                        controls
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => removeFile(fileObj.id)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => {
              reset();
              const count = selectedComp?.shotsPerTarget || 10;
              setShotScores(Array(count).fill({ value: '', isX: false }));
              setUploadedFiles([]);
            }}
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Reset Form
          </button>
          <button
            type="submit"
            disabled={submitScoreMutation.isLoading}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
          >
            {submitScoreMutation.isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Submitting...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Submit Score
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ScoreSubmission;
