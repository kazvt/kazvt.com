import cv2
import os
import sys

VIDEO_PATH = 'video.mp4'

HELP = [
    'Space: play/pause',
    'Right / D: next frame',
    'Left / A: previous frame',
    'Up / W: +10 frames',
    'Down / S: -10 frames',
    'Home: first frame',
    'End: last frame',
    'G: jump to frame',
    'Q or Esc: quit',
]


def open_video(path):
    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        raise FileNotFoundError(f'Could not open video: {path}')

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 0.0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    return cap, total_frames, fps, width, height


def clamp(value, lo, hi):
    return max(lo, min(hi, value))


def seek_and_read(cap, frame_index, total_frames):
    frame_index = clamp(frame_index, 0, max(0, total_frames - 1))
    cap.set(cv2.CAP_PROP_POS_FRAMES, frame_index)
    ok, frame = cap.read()
    if not ok:
        return None, frame_index
    actual_index = int(cap.get(cv2.CAP_PROP_POS_FRAMES)) - 1
    actual_index = clamp(actual_index, 0, max(0, total_frames - 1))
    return frame, actual_index


def draw_overlay(frame, frame_index, total_frames, fps, playing):
    h, w = frame.shape[:2]
    overlay = frame.copy()
    cv2.rectangle(overlay, (10, 10), (w - 10, 155), (0, 0, 0), -1)
    cv2.addWeighted(overlay, 0.45, frame, 0.55, 0, frame)

    status = 'PLAYING' if playing else 'PAUSED'
    lines = [
        f'Frame: {frame_index}',
        f'Total: {total_frames}',
        f'Time: {frame_index / fps:.3f}s' if fps > 0 else 'Time: n/a',
        f'FPS: {fps:.3f}' if fps > 0 else 'FPS: n/a',
        f'Status: {status}',
        ' | '.join(HELP[:4]),
        ' | '.join(HELP[4:]),
    ]

    y = 35
    for i, text in enumerate(lines):
        scale = 0.8 if i < 5 else 0.55
        thick = 2 if i < 5 else 1
        cv2.putText(frame, text, (22, y), cv2.FONT_HERSHEY_SIMPLEX,
                    scale, (255, 255, 255), thick, cv2.LINE_AA)
        y += 24 if i < 5 else 20

    return frame


def prompt_jump(current, total_frames):
    try:
        raw = input(f'Jump to frame (0-{max(0, total_frames - 1)}), current {current}: ').strip()
        if raw == '':
            return current
        return clamp(int(raw), 0, max(0, total_frames - 1))
    except (ValueError, EOFError, KeyboardInterrupt):
        return current


def main():
    video_path = sys.argv[1] if len(sys.argv) > 1 else VIDEO_PATH
    if not os.path.exists(video_path):
        print(f'File not found: {video_path}')
        print('Put video.mp4 next to this script or pass a path:')
        print('python frame_viewer.py video.mp4')
        sys.exit(1)

    cap, total_frames, fps, width, height = open_video(video_path)
    frame_index = 0
    playing = False

    frame, frame_index = seek_and_read(cap, frame_index, total_frames)
    if frame is None:
        print('Could not read first frame.')
        sys.exit(1)

    window_name = 'Frame Viewer'
    cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)
    cv2.resizeWindow(window_name, min(width, 1280), min(height, 900))

    print('\nControls:')
    for line in HELP:
        print(' -', line)
    print('')

    while True:
        display = draw_overlay(frame.copy(), frame_index, total_frames, fps, playing)
        cv2.imshow(window_name, display)

        if playing:
            delay = max(1, int(round(1000 / fps))) if fps > 0 else 33
            key = cv2.waitKeyEx(delay)
            next_index = frame_index + 1
            if next_index >= total_frames:
                playing = False
            else:
                next_frame, next_actual = seek_and_read(cap, next_index, total_frames)
                if next_frame is None:
                    playing = False
                else:
                    frame = next_frame
                    frame_index = next_actual
        else:
            key = cv2.waitKeyEx(0)

        if key in (27, ord('q'), ord('Q')):
            break
        elif key == ord(' '):
            playing = not playing
        elif key in (2555904, ord('d'), ord('D')):  # right
            next_frame, next_actual = seek_and_read(cap, frame_index + 1, total_frames)
            if next_frame is not None:
                frame, frame_index = next_frame, next_actual
            playing = False
        elif key in (2424832, ord('a'), ord('A')):  # left
            next_frame, next_actual = seek_and_read(cap, frame_index - 1, total_frames)
            if next_frame is not None:
                frame, frame_index = next_frame, next_actual
            playing = False
        elif key in (2490368, ord('w'), ord('W')):  # up
            next_frame, next_actual = seek_and_read(cap, frame_index + 10, total_frames)
            if next_frame is not None:
                frame, frame_index = next_frame, next_actual
            playing = False
        elif key in (2621440, ord('s'), ord('S')):  # down
            next_frame, next_actual = seek_and_read(cap, frame_index - 10, total_frames)
            if next_frame is not None:
                frame, frame_index = next_frame, next_actual
            playing = False
        elif key == 2359296:  # home
            next_frame, next_actual = seek_and_read(cap, 0, total_frames)
            if next_frame is not None:
                frame, frame_index = next_frame, next_actual
            playing = False
        elif key == 2293760:  # end
            next_frame, next_actual = seek_and_read(cap, total_frames - 1, total_frames)
            if next_frame is not None:
                frame, frame_index = next_frame, next_actual
            playing = False
        elif key in (ord('g'), ord('G')):
            playing = False
            print('')
            target = prompt_jump(frame_index, total_frames)
            next_frame, next_actual = seek_and_read(cap, target, total_frames)
            if next_frame is not None:
                frame, frame_index = next_frame, next_actual

    cap.release()
    cv2.destroyAllWindows()


if __name__ == '__main__':
    main()
