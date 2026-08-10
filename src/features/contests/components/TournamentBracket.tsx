import React, { useMemo } from 'react';
import { View, Text, useWindowDimensions, StyleSheet } from 'react-native';
import Svg, { Rect, Text as SvgText, G, Path, Circle } from 'react-native-svg';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, runOnJS } from 'react-native-reanimated';
import type { ContestMatch, ContestMatchParticipant } from '../types/contests.types';

interface TournamentBracketProps {
  matches: ContestMatch[];
  onMatchPress?: (match: ContestMatch) => void;
}

const NODE_WIDTH = 180;
const NODE_HEIGHT = 70;
const COLUMN_GAP = 80;
const ROW_GAP = 25;
const MARGIN_LEFT = 30;
const MARGIN_TOP = 40;



export const TournamentBracket: React.FC<TournamentBracketProps> = ({ matches, onMatchPress }) => {
  const { width: windowWidth } = useWindowDimensions();

  // Nhóm các trận đấu theo vòng (roundNo)
  // Loại bỏ trận tranh hạng 3 ra khỏi cây sơ đồ chính để tránh lệch nhánh
  const { rounds, maxRoundNo, totalMatches } = useMemo(() => {
    const mainMatches = matches.filter((m) => !m.metadata?.third_place);
    const roundGroups: { [key: number]: ContestMatch[] } = {};
    let maxRound = 1;

    mainMatches.forEach((m) => {
      if (!roundGroups[m.roundNo]) {
        roundGroups[m.roundNo] = [];
      }
      roundGroups[m.roundNo].push(m);
      if (m.roundNo > maxRound) {
        maxRound = m.roundNo;
      }
    });

    // Sắp xếp các trận trong từng vòng theo matchNo
    Object.keys(roundGroups).forEach((r) => {
      roundGroups[Number(r)].sort((a, b) => a.matchNo - b.matchNo);
    });

    return {
      rounds: roundGroups,
      maxRoundNo: maxRound,
      totalMatches: mainMatches.length,
    };
  }, [matches]);

  // Tính toán tọa độ của từng trận đấu trong sơ đồ
  const matchCoords = useMemo(() => {
    const coords: { [matchId: string]: { x: number; y: number } } = {};
    if (totalMatches === 0) return coords;

    // Vòng 1 (roundNo = 1) đặt tọa độ cố định từ trên xuống
    const r1Matches = rounds[1] || [];
    const r1Height = NODE_HEIGHT + ROW_GAP;
    r1Matches.forEach((match, idx) => {
      coords[match.id] = {
        x: MARGIN_LEFT,
        y: MARGIN_TOP + idx * r1Height,
      };
    });

    // Các vòng sau (roundNo > 1), tọa độ y là trung điểm của 2 trận cấp người ở vòng trước
    // Trận matchNo = m ở vòng r sẽ nhận người từ trận 2m-1 và 2m ở vòng r-1
    for (let r = 2; r <= maxRoundNo; r++) {
      const rMatches = rounds[r] || [];
      const prevRoundMatches = rounds[r - 1] || [];
      const colX = MARGIN_LEFT + (r - 1) * (NODE_WIDTH + COLUMN_GAP);

      rMatches.forEach((match) => {
        // Tìm 2 trận nguồn ở vòng trước
        const sourceMatch1 = prevRoundMatches.find((m) => m.nextMatchId === match.id || m.matchNo === match.matchNo * 2 - 1);
        const sourceMatch2 = prevRoundMatches.find((m) => m.nextMatchId === match.id || m.matchNo === match.matchNo * 2);

        let y = MARGIN_TOP;
        if (sourceMatch1 && sourceMatch2 && coords[sourceMatch1.id] && coords[sourceMatch2.id]) {
          y = (coords[sourceMatch1.id].y + coords[sourceMatch2.id].y) / 2;
        } else if (sourceMatch1 && coords[sourceMatch1.id]) {
          y = coords[sourceMatch1.id].y;
        } else {
          // Fallback nếu không khớp nhánh đấu
          const idx = match.matchNo - 1;
          const scaleOffset = Math.pow(2, r - 1);
          y = MARGIN_TOP + idx * r1Height * scaleOffset + (r1Height * (scaleOffset - 1)) / 2;
        }

        coords[match.id] = { x: colX, y };
      });
    }

    return coords;
  }, [rounds, maxRoundNo, totalMatches]);

  // Chiều rộng và chiều cao tổng của khung canvas SVG
  const { canvasWidth, canvasHeight } = useMemo(() => {
    if (totalMatches === 0) return { canvasWidth: windowWidth, canvasHeight: 300 };
    const numCols = maxRoundNo;
    const colWidth = NODE_WIDTH + COLUMN_GAP;
    const w = MARGIN_LEFT + numCols * colWidth - COLUMN_GAP + MARGIN_LEFT;

    // Chiều cao dựa theo số trận ở vòng 1
    const r1Count = rounds[1]?.length || 1;
    const h = MARGIN_TOP + r1Count * (NODE_HEIGHT + ROW_GAP) - ROW_GAP + MARGIN_TOP;

    return { canvasWidth: w, canvasHeight: h };
  }, [rounds, maxRoundNo, totalMatches, windowWidth]);

  // Zoom và Pan sử dụng Reanimated Shared Values
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Tạo cử chỉ Pinch (Zoom)
  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.max(0.5, Math.min(savedScale.value * e.scale, 3));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  // Tạo cử chỉ Pan (Dịch chuyển)
  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  // Tạo cử chỉ Tap vào trận đấu
  const handleMatchPressJS = (matchId: string) => {
    const clickedMatch = matches.find((m) => m.id === matchId);
    if (clickedMatch && onMatchPress) {
      onMatchPress(clickedMatch);
    }
  };

  const tapGesture = (matchId: string) =>
    Gesture.Tap().onEnd(() => {
      runOnJS(handleMatchPressJS)(matchId);
    });

  // Style động áp dụng Reanimated
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    };
  });

  // Gộp cử chỉ để chạy song song
  const combinedGesture = Gesture.Simultaneous(pinchGesture, panGesture);

  const getRoundName = (roundNo: number) => {
    const fromFinal = maxRoundNo - roundNo;
    if (fromFinal === 0) return 'Chung kết';
    if (fromFinal === 1) return 'Bán kết';
    if (fromFinal === 2) return 'Tứ kết';
    if (fromFinal === 3) return 'Vòng 1/8';
    return `Vòng ${roundNo}`;
  };

  const getParticipantName = (p: ContestMatchParticipant | undefined) => {
    if (!p) return 'Chờ vòng trước';
    return p.fullName || 'Ẩn danh';
  };

  const getParticipantColor = (p: ContestMatchParticipant | undefined) => {
    if (!p) return '#a3a3a3'; // gray-400
    if (p.isWinner) return '#047857'; // emerald-700
    return '#1f2937'; // gray-800
  };

  const getParticipantFontWeight = (p: ContestMatchParticipant | undefined) => {
    if (p && p.isWinner) return 'bold';
    return 'normal';
  };

  return (
    <GestureHandlerRootView className="flex-1 bg-gray-50/50 rounded-2xl overflow-hidden border border-gray-100">
      {totalMatches === 0 ? (
        <View className="py-12 items-center justify-center">
          <Text className="text-sm font-bold text-gray-400 italic">Chưa bốc thăm nên chưa có sơ đồ nhánh đấu.</Text>
        </View>
      ) : (
        <GestureDetector gesture={combinedGesture}>
          <View className="flex-1">
            <Animated.View style={[animatedStyle, { width: canvasWidth, height: canvasHeight }]}>
              <Svg
                width="100%"
                height="100%"
                viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
                preserveAspectRatio="xMidYMid meet"
              >
                <G>
                {/* 1. Vẽ các đường nối (Connector Lines) trước để nằm dưới Card */}
                {Object.keys(rounds).map((rStr) => {
                  const r = Number(rStr);
                  const roundMatches = rounds[r] || [];
                  if (r === maxRoundNo) return null; // Vòng chung kết không nối tiếp sang phải

                  return roundMatches.map((match) => {
                    const startCoord = matchCoords[match.id];
                    if (!startCoord) return null;

                    // Điểm xuất phát (giữa cạnh phải của Card hiện tại)
                    const x1 = startCoord.x + NODE_WIDTH;
                    const y1 = startCoord.y + NODE_HEIGHT / 2;

                    // Tìm trận đích tiếp theo
                    const nextMatch = matches.find((m) => m.id === match.nextMatchId);
                    if (!nextMatch) return null;

                    const endCoord = matchCoords[nextMatch.id];
                    if (!endCoord) return null;

                    // Điểm đích (giữa cạnh trái của Card tiếp theo)
                    const x2 = endCoord.x;
                    const y2 = endCoord.y + NODE_HEIGHT / 2;

                    const xMid = (x1 + x2) / 2;

                    // Vẽ đường kẻ bậc thang kết nối
                    const pathData = `M ${x1} ${y1} H ${xMid} V ${y2} H ${x2}`;

                    return (
                      <Path
                        key={`line-${match.id}`}
                        d={pathData}
                        fill="none"
                        stroke="#cbd5e1" // slate-300
                        strokeWidth="2"
                      />
                    );
                  });
                })}

                {/* 2. Vẽ các Card trận đấu */}
                {matches
                  .filter((m) => !m.metadata?.third_place)
                  .map((match) => {
                    const coord = matchCoords[match.id];
                    if (!coord) return null;

                    const p1 = match.participants.find((p) => p.slotNo === 1);
                    const p2 = match.participants.find((p) => p.slotNo === 2);
                    const isBye = match.metadata?.bye;
                    const isDone = match.status === 'COMPLETED';
                    const isLive = match.status === 'RUNNING';

                    const cardBorderColor = isLive ? '#3b82f6' : '#e2e8f0'; // border-blue-500 hoặc border-slate-200
                    const cardBgColor = '#ffffff';

                    return (
                      <G 
                        key={match.id} 
                        transform={`translate(${coord.x}, ${coord.y})`}
                      >
                        {/* Viền ngoài Card */}
                        <Rect
                          x="0"
                          y="0"
                          width={NODE_WIDTH}
                          height={NODE_HEIGHT}
                          rx="8"
                          ry="8"
                          fill={cardBgColor}
                          stroke={cardBorderColor}
                          strokeWidth={isLive ? '2' : '1'}
                        />

                        {/* Tiêu đề trận đấu (Header bar nhỏ) */}
                        <Rect
                          x="1"
                          y="1"
                          width={NODE_WIDTH - 2}
                          height="18"
                          rx="6"
                          ry="6"
                          fill="#f8fafc" // slate-50
                        />
                        <SvgText
                          x="8"
                          y="13"
                          fontSize="9"
                          fontWeight="bold"
                          fill="#64748b" // slate-500
                        >
                          {match.name || `Trận ${match.matchNo}`}
                        </SvgText>

                        {/* Ngăn cách Header */}
                        <Path d={`M 1 19 H ${NODE_WIDTH - 1}`} stroke="#f1f5f9" strokeWidth="1" />

                        {/* Participant 1 Slot */}
                        <Rect
                          x="2"
                          y="20"
                          width={NODE_WIDTH - 4}
                          height="23"
                          fill={p1?.isWinner ? '#ecfdf5' : 'transparent'} // emerald-50
                          rx="4"
                          ry="4"
                        />
                        <SvgText
                          x="8"
                          y="36"
                          fontSize="10"
                          fontWeight={getParticipantFontWeight(p1)}
                          fill={getParticipantColor(p1)}
                        >
                          {getParticipantName(p1)}
                        </SvgText>
                        {p1?.isWinner && (
                          <SvgText x={NODE_WIDTH - 20} y={35} fontSize="10" fill="#059669">🏆</SvgText>
                        )}

                        {/* Ngăn cách giữa 2 VĐV */}
                        <Path d={`M 4 43 H ${NODE_WIDTH - 4}`} stroke="#f1f5f9" strokeWidth="1" />

                        {/* Participant 2 Slot */}
                        <Rect
                          x="2"
                          y="44"
                          width={NODE_WIDTH - 4}
                          height="24"
                          fill={p2?.isWinner ? '#ecfdf5' : 'transparent'} // emerald-50
                          rx="4"
                          ry="4"
                        />
                        <SvgText
                          x="8"
                          y="60"
                          fontSize="10"
                          fontWeight={getParticipantFontWeight(p2)}
                          fill={getParticipantColor(p2)}
                        >
                          {isBye && !p2 ? 'Không có đối thủ' : getParticipantName(p2)}
                        </SvgText>
                        {p2?.isWinner && (
                          <SvgText x={NODE_WIDTH - 20} y={59} fontSize="10" fill="#059669">🏆</SvgText>
                        )}
                      </G>
                    );
                  })}
                </G>
              </Svg>
            </Animated.View>
          </View>
        </GestureDetector>
      )}
    </GestureHandlerRootView>
  );
};
