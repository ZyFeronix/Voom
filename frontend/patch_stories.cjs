const fs = require('fs');

const path = 'D:/Vsocial/frontend/src/routes/feed/+page.svelte';
let content = fs.readFileSync(path, 'utf8');

// Replace startStoryTimer
const target1 = `  function startStoryTimer() {
    clearInterval(storyInterval);
    const stepTime = 50; // duration is 5s, so 100 steps of 50ms
    const totalDuration = 5000;
    let elapsed = 0;

    storyInterval = setInterval(() => {
      elapsed += stepTime;
      storyProgress = (elapsed / totalDuration) * 100;

      if (elapsed >= totalDuration) {
        nextStoryItem();
      }
    }, stepTime);
  }`;

const replacement1 = `  function startStoryTimer(durationOverride = null) {
    clearInterval(storyInterval);
    const item = selectedStoryUser?.items[selectedStoryIndex];
    if (!item) return;

    if (item.media_type === 'video' && !durationOverride) {
      storyProgress = 0;
      return; 
    }

    const stepTime = 50;
    const totalDuration = durationOverride || 5000;
    let elapsed = 0;

    storyInterval = setInterval(() => {
      elapsed += stepTime;
      storyProgress = (elapsed / totalDuration) * 100;

      if (elapsed >= totalDuration) {
        nextStoryItem();
      }
    }, stepTime);
  }`;

// Replace media-player
const target2 = `        {#if selectedStoryUser.items[selectedStoryIndex].media_type === 'video'}
          <media-player
            src={selectedStoryUser.items[selectedStoryIndex].media_url}
            autoplay
            playsInline
            class="max-w-full max-h-full"
            style="--media-provider-fit: contain"
          >
            <media-outlet></media-outlet>
            <media-community-skin></media-community-skin>
          </media-player>`;

const replacement2 = `        {#if selectedStoryUser.items[selectedStoryIndex].media_type === 'video'}
          <!-- svelte-ignore a11y_media_has_caption -->
          <video
            src={selectedStoryUser.items[selectedStoryIndex].media_url}
            autoplay
            playsinline
            class="w-full h-full object-contain"
            onloadedmetadata={(e) => startStoryTimer(e.currentTarget.duration * 1000)}
          ></video>`;

// normalize newlines for safety
const norm = (s) => s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

content = norm(content);
const normTarget1 = norm(target1);
const normTarget2 = norm(target2);

if (content.includes(normTarget1)) {
	content = content.replace(normTarget1, replacement1);
	console.log('Replaced startStoryTimer');
} else {
	console.log('Could not find target1');
}

if (content.includes(normTarget2)) {
	content = content.replace(normTarget2, replacement2);
	console.log('Replaced media-player');
} else {
	console.log('Could not find target2');
}

fs.writeFileSync(path, content, 'utf8');
console.log('Done');
