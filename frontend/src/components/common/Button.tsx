import { CommandBarButton, DefaultButton, IButtonProps, IconButton, Image} from "@fluentui/react";

import styles from './Button.module.css';


type Color = 'purple' | 'blue' | 'salmon' | 'green';

interface ButtonProps extends IButtonProps {
  onClick: () => void;
  text: string | undefined;
  color?: Color;
}

export const ShareButton: React.FC<ButtonProps> = ({ onClick, text, color= 'purple' }) => {
  const colorStyles: Record<Color, string> = {
    purple: styles.purple,
    blue: styles.blue,
    salmon: styles.salmon,
    green: styles.green,
  };
  const buttonStyle = colorStyles[color];
  return (
    <CommandBarButton
      className={[styles.shareButtonRoot, buttonStyle].join(' ')}
      onClick={onClick}
      text={text}
    />
  )
}

export const HistoryButton: React.FC<ButtonProps> = ({ onClick, text }) => {
  return (
    <DefaultButton
      className={styles.historyButtonRoot}
      text={text}
      iconProps={{ iconName: 'History' }}
      onClick={onClick}
    />
  )
}

interface HistoryArrowButtonProps {
  image: string;
  onClick: () => void;
}

export const HistoryArrowButton: React.FC<HistoryArrowButtonProps> = ({ image, onClick }) => {
  return (
    <IconButton
      onClick={onClick}
      styles={{ root: { padding:0} }} // Remove padding to make IconButton fit the image
    >
      <Image src={image} alt="Arrow button to open menu" width={32} height={32}  />
    </IconButton>
  );
};
