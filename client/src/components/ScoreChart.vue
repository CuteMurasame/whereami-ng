<template>
  <div class="rating-chart-container">
    <div class="chart-header">
      <div class="mode-tabs">
        <button 
          v-for="m in ['moving', 'nm', 'nmpz']" 
          :key="m"
          :class="['tab-btn', { active: chartMode === m }]"
          @click="chartMode = m"
        >
          {{ t(`analysis.${m}`) }}
        </button>
      </div>
    </div>
    <canvas id="scoreStatus" width="640" height="80"></canvas>
    <canvas id="scoreGraph" width="640" height="360"></canvas>
  </div>
</template>

<script setup>
import { onMounted, watch, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { api } from '../auth';

const { t } = useI18n();
const props = defineProps({
  userId: {
    type: Number,
    required: true
  }
});

const chartMode = ref('moving');

onMounted(() => {
  const loadCreateJS = () => {
    return new Promise((resolve, reject) => {
      if (window.createjs) {
        resolve(window.createjs);
        return;
      }
      const script = document.createElement('script');
      script.src = '/js/createjs.min.js';
      script.onload = () => resolve(window.createjs);
      script.onerror = reject;
      document.head.appendChild(script);
    });
  };

  loadCreateJS().then(async (cj) => {
    if (!cj) {
      console.error("CreateJS not found");
      return;
    }

    var history_data = [];
    var mode_data = {
        moving: [],
        nm: [],
        nmpz: []
    };
    
    // Stage variables
    var stage_graph, stage_status;
    var chart_container;
    
    // Constants
    const OFFSET_X = 50;
    const OFFSET_Y = 10;
    var canvas_status = document.getElementById("scoreStatus");
    const STATUS_WIDTH = canvas_status.width - OFFSET_X - 10;
    const STATUS_HEIGHT = canvas_status.height - OFFSET_Y - 5;
    var canvas_graph = document.getElementById("scoreGraph");
    const RIGHT_MARGIN = 20;
    const PANEL_WIDTH = canvas_graph.width - OFFSET_X - RIGHT_MARGIN;
    const PANEL_HEIGHT = canvas_graph.height - OFFSET_Y - 30;
    
    const LABEL_FONT = "12px Lato";
    const COLORS = [
        [0,     "#008000", 0.15],
        [5000,  "#00C0C0", 0.2],
        [10000, "#0000FF", 0.1],
        [15000, "#C0C000", 0.25],
        [20000, "#FF8000", 0.2],
        [24000, "#FF0000", 0.1]
    ];
    const STAR_MIN = 24000;
    const PARTICLE_MIN = 3;
    const PARTICLE_MAX = 20;
    const LIFE_MAX = 30;

    // Graph Elements
    var panel_shape, border_shape;
    var border_status_shape;
    var rating_text, place_text, diff_text, date_text, contest_name_text;
    var particles;
    var standings_url;
    
    // Scaling
    var n, y_min, y_max;
    var labels_container;

    await fetchData();
    init();

    watch(() => props.userId, async () => {
        await fetchData();
        updateGraph();
    });
    
    watch(chartMode, () => {
        updateGraph();
    });

    async function fetchData() {
        if (!props.userId) return;
        
        mode_data = { moving: [], nm: [], nmpz: [] };
        history_data = [];

        try {
            const res = await api.get(`/user/${props.userId}/games?type=singleplayer&limit=50`);
            const games = res.data.reverse().filter(g => g.status === 'finished');
            
            // Categorize first
            const gamesByMode = { moving: [], nm: [], nmpz: [] };
            games.forEach(g => {
                if (gamesByMode[g.mode]) gamesByMode[g.mode].push(g);
            });
            
            // Populate mode_data with mode-specific indices
            Object.keys(gamesByMode).forEach(mode => {
                mode_data[mode] = gamesByMode[mode].map((g, idx) => ({
                    Index: idx, // Local index for this mode
                    EndTime: Math.floor(new Date(g.created_at).getTime() / 1000),
                    NewRating: g.total_score, 
                    Place: g.mode, 
                    ContestName: g.Map ? g.Map.name : 'Classic World',
                    StandingsUrl: `/singleplayer/analysis/${g.id}`
                }));
            });
            
        } catch (e) {
            console.error("Failed to fetch game history", e);
        }
    }

    function init() {
        stage_graph = new cj.Stage("scoreGraph");
        stage_status = new cj.Stage("scoreStatus");
        initStage(stage_graph, canvas_graph);
        initStage(stage_status, canvas_status);

        y_min = 0;
        y_max = 25500;

        initBackground();
        initStatus();
        updateGraph(); 
        
        cj.Ticker.setFPS(60);
        cj.Ticker.removeEventListener("tick", handleTick);
        cj.Ticker.addEventListener("tick", handleTick);

        function handleTick(event) {
            updateParticles();
            stage_status.update();
        }
    }
    
    function updateGraph() {
        if (chart_container) {
            stage_graph.removeChild(chart_container);
        }
        
        chart_container = new cj.Container();
        stage_graph.addChild(chart_container);
        chart_container.shadow = new cj.Shadow("rgba(0,0,0,0.3)", 1, 2, 3);
        
        const currentData = mode_data[chartMode.value] || [];
        n = currentData.length; 
        
        drawChartLayer(currentData);
        
        if (currentData.length > 0) {
            setStatus(currentData[currentData.length - 1], false);
        }
        
        stage_graph.update();
        stage_status.update();
    }
    
    function initBackground() {
        panel_shape = newShape(stage_graph);
        panel_shape.x = OFFSET_X;
        panel_shape.y = OFFSET_Y;
        panel_shape.alpha = 0.3;

        border_shape = newShape(stage_graph);
        border_shape.x = OFFSET_X;
        border_shape.y = OFFSET_Y;

        function newLabelY(s, y) {
            var t = new cj.Text(s, LABEL_FONT, "#000");
            t.x = OFFSET_X - 10;
            t.y = OFFSET_Y + y;
            t.textAlign = "right";
            t.textBaseline = "middle";
            stage_graph.addChild(t);
        }

        var y1 = 0;
        for (var i = COLORS.length - 1; i >= 0; i--) {
            var y2 = PANEL_HEIGHT - PANEL_HEIGHT * getPerY(COLORS[i][0]);
            let startY = Math.max(0, y1);
            let endY = Math.min(y2, PANEL_HEIGHT);
            if (endY > startY) {
                panel_shape.graphics.f(COLORS[i][1]).r(0, startY, PANEL_WIDTH, endY - startY);
            }
            y1 = y2;
        }
        if (y1 < PANEL_HEIGHT) {
             panel_shape.graphics.f(COLORS[0][1]).r(0, y1, PANEL_WIDTH, PANEL_HEIGHT - y1);
        }

        for (var i = 0; i <= 25000; i += 5000) {
            var y = PANEL_HEIGHT - PANEL_HEIGHT * getPerY(i);
            newLabelY(String(i), y);
            border_shape.graphics.s("#FFF").ss(0.5);
            border_shape.graphics.mt(0, y).lt(PANEL_WIDTH, y);
        }
        
        border_shape.graphics.s("#FFF").ss(1.5).mt(0, 0).lt(0, PANEL_HEIGHT).lt(PANEL_WIDTH, PANEL_HEIGHT).lt(PANEL_WIDTH, 0);

        var credit = new cj.Text("Design from AtCoder", "12px Lato", "#888");
        credit.x = canvas_graph.width - 10;
        credit.y = canvas_graph.height;
        credit.textAlign = "right";
        credit.textBaseline = "bottom";
        stage_graph.addChild(credit);
    }
    
    function drawXLabels(data) {
        if (labels_container) stage_graph.removeChild(labels_container);
        labels_container = new cj.Container();
        stage_graph.addChild(labels_container);
        
        function newLabelX(s, x, y) {
            var t = new cj.Text(s, LABEL_FONT, "#000");
            t.x = x;
            t.y = OFFSET_Y + PANEL_HEIGHT + 5 + y;
            t.textAlign = "center";
            t.textBaseline = "top";
            labels_container.addChild(t);
        }
        
        let count = data.length;
        if (count === 0) return;
        
        let step = Math.max(1, Math.floor(count / 6)); 
        
        var tick_shape = newShape(labels_container);
        tick_shape.graphics.s("#888").ss(1);
        
        for(let i=0; i<count; i+=step) {
            drawOne(i);
        }
        if ((count-1) % step > step/2) {
             drawOne(count-1);
        }

        function drawOne(i) {
             let x = getX(i) - OFFSET_X; 
             let date = new Date(data[i].EndTime * 1000);
             let label = (date.getMonth()+1) + "/" + date.getDate();
             newLabelX(label, getX(i), 0);
             tick_shape.graphics.mt(x + OFFSET_X, OFFSET_Y + PANEL_HEIGHT).lt(x + OFFSET_X, OFFSET_Y + PANEL_HEIGHT + 4);
        }
    }

    function drawChartLayer(points) {
        drawXLabels(points);
        if (points.length === 0) return;

        function mouseoverVertex(e) {
            cj.Tween.get(e.target).to({scaleX: 1.5, scaleY: 1.5}, 200, cj.Ease.quadOut);
            setStatus(e.target.dataRef, true);
        };
        function mouseoutVertex(e) {
            cj.Tween.get(e.target).to({scaleX: 1, scaleY: 1}, 200, cj.Ease.quadOut);
        };

        for (var j = 0; j < 2; j++) {
            const line_shape = newShape(chart_container);
            if (j == 0) line_shape.graphics.s("#AAA").ss(2);
            else line_shape.graphics.s("#FFF").ss(0.5);
            drawSmoothPath(line_shape.graphics, points, true);
        }

        points.forEach((p) => {
            const vertex = newShape(chart_container);
            const color = getColor(p.NewRating)[1];
            vertex.graphics.s("#FFF").ss(0.5).f(color).dc(0, 0, 3.5);
            vertex.x = getX(p.Index);
            vertex.y = OFFSET_Y + (PANEL_HEIGHT - PANEL_HEIGHT * getPerY(p.NewRating));
            vertex.dataRef = p;
            
            var hitArea = new cj.Shape();
            hitArea.graphics.f("#000").dc(0, 0, 8);
            vertex.hitArea = hitArea;
            vertex.cursor = "pointer";
            
            vertex.addEventListener("mouseover", mouseoverVertex);
            vertex.addEventListener("mouseout", mouseoutVertex);
            vertex.addEventListener("click", () => {
                 window.location.href = p.StandingsUrl;
            });
        });
    }

    function getX(index) {
        if (n <= 1) return OFFSET_X + PANEL_WIDTH / 2;
        return OFFSET_X + (index / (n - 1)) * PANEL_WIDTH;
    }
    
    function getPerY(y) {
        return (y - y_min) / (y_max - y_min);
    }
    
    function getColor(x) {
        if (x >= 24000) return [-1, "#FF0000", 1];
        if (x >= 20000) return [-1, "#FF8000", 1];
        if (x >= 15000) return [-1, "#C0C000", 1];
        if (x >= 10000) return [-1, "#0000FF", 1];
        if (x >= 5000)  return [-1, "#00C0C0", 1];
        return [-1, "#008000", 1];
    }

    function drawSmoothPath(g, points, move = false) {
         if (points.length < 1) return;
         const xFn = (p) => getX(p.Index);
         const yFn = (p) => OFFSET_Y + (PANEL_HEIGHT - PANEL_HEIGHT * getPerY(p.NewRating));
         if (move) g.mt(xFn(points[0]), yFn(points[0]));
         else g.lt(xFn(points[0]), yFn(points[0]));
         for (let i = 1; i < points.length; i++) {
             g.lt(xFn(points[i]), yFn(points[i]));
         }
    }

    function initStatus() {
        border_status_shape = newShape(stage_status);
        rating_text = newText(stage_status, OFFSET_X + 75, OFFSET_Y + STATUS_HEIGHT / 2, "40px 'Squada One'");
        place_text = newText(stage_status, OFFSET_X + 175, OFFSET_Y + STATUS_HEIGHT / 2, "18px 'Fira Code'");
        diff_text = newText(stage_status, OFFSET_X + 175, OFFSET_Y + STATUS_HEIGHT / 1.5, "11px Lato");
        diff_text.color = '#888';
        date_text = newText(stage_status, OFFSET_X + 230, OFFSET_Y + STATUS_HEIGHT / 4, "14px Lato");
        contest_name_text = newText(stage_status, OFFSET_X + 230, OFFSET_Y + STATUS_HEIGHT / 1.6, "20px Lato");
        date_text.textAlign = contest_name_text.textAlign = "left";
        contest_name_text.maxWidth = STATUS_WIDTH - 230 - 10;
        {
            var hitArea = new cj.Shape(); hitArea.graphics.f("#000").r(0,-12,contest_name_text.maxWidth,24);
            contest_name_text.hitArea = hitArea;
            contest_name_text.cursor = "pointer";
            contest_name_text.addEventListener("click", function(){
                if(standings_url) location.href = standings_url;
            });
        }
        particles = new Array();
        for (var i = 0; i < PARTICLE_MAX; i++) {
            particles.push(newText(stage_status, 0, 0, "64px Lato"));
            particles[i].visible = false;
        }
    }

    function setStatus(data, particle_flag) {
        var date = new Date(data.EndTime * 1000);
        var rating = data.NewRating;
        var place = data.Place;
        var contest_name = data.ContestName;
        var color = getColor(rating)[1];
        
        border_status_shape.graphics.c().s(color).ss(1).rr(OFFSET_X, OFFSET_Y, STATUS_WIDTH, STATUS_HEIGHT, 2);
        rating_text.text = rating;
        rating_text.color = color;
        place_text.text = place ? place.toUpperCase() : '';
        diff_text.text = ''; 
        date_text.text = date.toLocaleDateString();
        contest_name_text.text = contest_name;
        if (particle_flag) {
            let alpha = 1;
            var particle_num = 10;
            setParticles(particle_num, color, alpha, rating);
        }
        standings_url = data.StandingsUrl;
    }

    function initStage(stage, canvas) {
        var width = canvas.getAttribute('width');
        var height = canvas.getAttribute('height');
        if (window.devicePixelRatio) {
            canvas.setAttribute('width', Math.round(width * window.devicePixelRatio));
            canvas.setAttribute('height', Math.round(height * window.devicePixelRatio));
            stage.scaleX = stage.scaleY = window.devicePixelRatio;
        }
        canvas.style.maxWidth = width+"px";
        canvas.style.maxHeight = height+"px";
        canvas.style.width = canvas.style.height = "100%";
        stage.enableMouseOver(20);
    }

    function newShape(parent) {
        var s = new cj.Shape();
        parent.addChild(s);
        return s;
    }

    function newText(parent, x, y, font) {
        var t = new cj.Text("", font, "#000");
        t.x = x;
        t.y = y;
        t.textAlign = "center";
        t.textBaseline = "middle";
        parent.addChild(t);
        return t;
    }

    function setParticle(particle, x, y, color, alpha, star_flag) {
        particle.x = x;
        particle.y = y;
        var ang = Math.random() * Math.PI * 2;
        var speed = Math.random() * 4 + 4;
        particle.vx = Math.cos(ang) * speed;
        particle.vy = Math.sin(ang) * speed;
        particle.rot_speed = Math.random()*20+10;
        particle.life = LIFE_MAX;
        particle.visible = true;
        particle.color = color;
        if (star_flag) {
            particle.text = "★";
        } else {
            particle.text = "@";
        }
        particle.alpha = alpha;
    }

    function setParticles(num, color, alpha, rating) {
        for (var i = 0; i < PARTICLE_MAX; i++) {
            if (i < num) {
                setParticle(particles[i], rating_text.x, rating_text.y, color, alpha, rating >= STAR_MIN);
            } else {
                particles[i].life = 0;
                particles[i].visible = false;
            }
        }
    }

    function updateParticle(particle) {
        if (particle.life <= 0) {
            particle.visible = false;
            return;
        }
        particle.x += particle.vx;
        particle.vx *= 0.9;
        particle.y += particle.vy;
        particle.vy *= 0.9;
        particle.life--;
        particle.scaleX = particle.scaleY = particle.life / LIFE_MAX;
        particle.rotation += particle.rot_speed;
    }

    function updateParticles() {
        for (var i = 0; i < PARTICLE_MAX; i++) {
            if (particles[i].life > 0) {
                updateParticle(particles[i]);
            }
        }
    }
  });

});
</script>

<style scoped>
.rating-chart-container {
  width: 100%;
  max-width: 800px;
  margin: 0 auto 2rem auto;
  background: #fff;
  padding: 10px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}
canvas {
  display: block;
  margin: 0 auto;
}
.chart-header {
  display: flex;
  justify-content: flex-end;
  padding: 0 10px 10px 10px;
}
.mode-tabs { display: flex; gap: 5px; background: #f3f4f6; padding: 4px; border-radius: 6px; border: 1px solid #e5e7eb; }
.tab-btn { 
  background: transparent; border: none; padding: 6px 12px; border-radius: 4px; 
  color: #6b7280; cursor: pointer; font-size: 0.85rem; font-weight: 600;
  transition: all 0.2s;
}
.tab-btn.active { background: #fff; color: #4f46e5; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
.tab-btn:hover:not(.active) { color: #1f2937; }
</style>
