import { PredictionEntry } from '../types';

export interface InitialIndicator {
    datetime: string;
    trend_type: number;
    timeframe: string;
    end_datetime: string | null;
}

export interface Propagation {
    propagation_id: string;
    propagation_level: number;
    datetime: string;
    trend_type: number;
    higher_freq: string;
    lower_freq: string;
}

function timeframeToSeconds(timeframe: string): number {
    const match = timeframe.match(/^(\d+)(s|m|h|d|w|mo)$/);
    if (!match) return 0;

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
        case 's': return value;
        case 'm': return value * 60;
        case 'h': return value * 3600;
        case 'd': return value * 86400;
        case 'w': return value * 604800;
        case 'mo': return value * 2592000;
        default: return 0;
    }
}

export function extractTrendIndicators(
    allPredictions: Record<string, PredictionEntry[]>
): { initialIndicators: InitialIndicator[], propagations: Propagation[] } {
    const timeframes = Object.keys(allPredictions);
    const sortedTimeframes = timeframes.sort((a, b) => timeframeToSeconds(a) - timeframeToSeconds(b));

    if (sortedTimeframes.length === 0) {
        return { initialIndicators: [], propagations: [] };
    }

    const highestFreqTimeframe = sortedTimeframes[0];
    const highestFreqPredictions = allPredictions[highestFreqTimeframe] || [];

    // Sort predictions by datetime
    const sortedPredictions = [...highestFreqPredictions].sort((a, b) =>
        new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
    );

    // Step 1: Identify initial directional indicators
    const initialIndicators: InitialIndicator[] = [];
    let lastSignal: number | null = null;

    for (const pred of sortedPredictions) {
        if (pred.value !== 0) {
            if (lastSignal === null || pred.value !== lastSignal) {
                initialIndicators.push({
                    datetime: pred.datetime,
                    trend_type: pred.value,
                    timeframe: highestFreqTimeframe,
                    end_datetime: null
                });
                lastSignal = pred.value;
            }
        }
    }

    // Assign end_datetime based on the next opposing signal
    for (let i = 0; i < initialIndicators.length; i++) {
        const startDatetime = new Date(initialIndicators[i].datetime);
        const trendType = initialIndicators[i].trend_type;
        const opposingSignalValue = -trendType;

        const laterSignal = sortedPredictions.find(pred =>
            new Date(pred.datetime) > startDatetime &&
            pred.value === opposingSignalValue
        );

        if (laterSignal) {
            initialIndicators[i].end_datetime = laterSignal.datetime;
        } else {
            initialIndicators[i].end_datetime = sortedPredictions[sortedPredictions.length - 1]?.datetime || null;
        }
    }

    // Step 2: Identify cross-timeframe propagations
    const propagations: Propagation[] = [];
    let propagationCounter = 0;

    for (const initialInd of initialIndicators) {
        const currentDatetime = new Date(initialInd.datetime);
        const currentType = initialInd.trend_type;
        const currentTimeframeIndex = sortedTimeframes.indexOf(initialInd.timeframe);
        const endDatetime = initialInd.end_datetime ? new Date(initialInd.end_datetime) : null;

        if (!endDatetime) continue;

        let currentChainDatetime = currentDatetime;
        let currentChainTimeframeIndex = currentTimeframeIndex;
        let propagationLevel = 0;

        propagationCounter++;
        const currentPropagationId = `Prop_${propagationCounter}`;

        // Continue the chain through lower timeframes
        for (let j = currentChainTimeframeIndex + 1; j < sortedTimeframes.length; j++) {
            const nextLowerTimeframe = sortedTimeframes[j];
            const nextLowerPredictions = allPredictions[nextLowerTimeframe] || [];

            // Find the first occurrence of the same signal in the next lower timeframe
            const laterSignals = nextLowerPredictions.filter(pred => {
                const predDatetime = new Date(pred.datetime);
                return predDatetime >= currentChainDatetime &&
                       predDatetime <= endDatetime &&
                       pred.value === currentType;
            }).sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());

            if (laterSignals.length > 0) {
                const nextSignal = laterSignals[0];
                const nextSignalDatetime = new Date(nextSignal.datetime);

                // Check for opposing signal in the highest frequency timeframe
                const initialFreqPredictions = allPredictions[sortedTimeframes[currentTimeframeIndex]] || [];
                const opposingSignalValue = -currentType;

                const opposingSignalFound = initialFreqPredictions.some(pred => {
                    const predDatetime = new Date(pred.datetime);
                    return predDatetime > currentChainDatetime &&
                           predDatetime <= nextSignalDatetime &&
                           pred.value === opposingSignalValue;
                });

                if (!opposingSignalFound) {
                    propagationLevel++;
                    propagations.push({
                        propagation_id: currentPropagationId,
                        propagation_level: propagationLevel,
                        datetime: nextSignal.datetime,
                        trend_type: currentType,
                        higher_freq: sortedTimeframes[currentChainTimeframeIndex],
                        lower_freq: nextLowerTimeframe
                    });

                    currentChainDatetime = nextSignalDatetime;
                    currentChainTimeframeIndex = j;
                } else {
                    break;
                }
            } else {
                break;
            }
        }
    }

    return { initialIndicators, propagations };
}
