import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import RoomView from './RoomView';

// Import the RoomViewProps interface from RoomView
interface PresenterViewProps {
  isPasswordProtected?: boolean;
}

const PresenterView: React.FC<PresenterViewProps> = ({ isPasswordProtected = false }) => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  
  // Redirect to the new URL format
  useEffect(() => {
    if (roomId) {
      navigate(`/room/${roomId}?access=p`, { replace: true });
    }
  }, [roomId, navigate]);
  
  // Render the RoomView with presenter=true while redirecting
  return <RoomView isPasswordProtected={isPasswordProtected} isPresenter={true} />;
};

export default PresenterView; 