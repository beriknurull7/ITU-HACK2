// Demo transfer relationships. The renderer projects 3D positions into a canvas.
const QNetwork = (() => {
  function related(record, rows, ownerOf) {
    const others = rows
      .filter((other) => other.flagged && other.id !== record.id)
      .sort((a, b) => b.time - a.time || b.id - a.id);
    return {
      same: others.filter((other) => other.recipient === record.recipient),
      viaCustomer: others.filter(
        (other) =>
          ownerOf(other) === ownerOf(record) &&
          other.recipient !== record.recipient,
      ),
    };
  }
  const fitsTime = (record, days, now = Date.now()) =>
    !Number(days) || record.time >= now - Number(days) * 86400000;

  function layout(transfers) {
    const nodes = new Map();
    for (const edge of transfers) {
      const from = "customer:" + edge.owner;
      const to = "recipient:" + edge.recipient;
      nodes.set(from, { id: from, type: "customer", label: edge.customerName });
      nodes.set(to, { id: to, type: "recipient", label: edge.recipientName });
    }
    for (const side of ["customer", "recipient"]) {
      const group = [...nodes.values()].filter((node) => node.type === side);
      group.sort((a, b) => a.label.localeCompare(b.label));
      group.forEach((node, i) => {
        const spacing = Math.min(0.82, 2.25 / Math.max(1, group.length - 1));
        node.point = [
          side === "customer" ? -1.7 : 1.7,
          (i - (group.length - 1) / 2) * spacing,
          0,
        ];
      });
    }
    const ordered = [...transfers].sort(
      (a, b) => a.time - b.time || a.id - b.id,
    );
    const edges = ordered.map((edge, i) => {
      const from = nodes.get("customer:" + edge.owner);
      const to = nodes.get("recipient:" + edge.recipient);
      const depth =
        ordered.length === 1 ? 0 : (i / (ordered.length - 1)) * 2.4 - 1.2;
      return {
        ...edge,
        from,
        to,
        bend: [0, (from.point[1] + to.point[1]) / 2, depth],
      };
    });
    return { nodes: [...nodes.values()], edges };
  }

  function timeline(events) {
    return {
      nodes: events.map((event, i) => ({
        id: i,
        type: event.role === "analyst" ? "recipient" : "customer",
        label: String(i + 1),
        point: [
          events.length === 1 ? 0 : (i / (events.length - 1)) * 3.6 - 1.8,
          event.role === "analyst" ? -0.55 : 0.55,
          [-0.9, 0, 0.9][event.phase],
        ],
      })),
      edges: [],
      timeline: true,
    };
  }

  function attach(canvas, graph, selected, onPick) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const view = { yaw: -0.36, pitch: 0.19, zoom: 1 };
    let hits = [],
      pointer = null,
      frame = 0;
    const clamp = (n, min, max) => Math.max(min, Math.min(n, max));
    function paint() {
      if (!canvas.isConnected) return;
      const width = canvas.clientWidth,
        height = canvas.clientHeight;
      if (!width || !height) return;
      const pixelRatio = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.round(width * pixelRatio),
        h = Math.round(height * pixelRatio);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const style = getComputedStyle(canvas);
      const colors = Object.fromEntries(
        ["surface", "label", "edge", "selected", "customer", "recipient"].map(
          (key) => [key, style.getPropertyValue("--network-" + key).trim()],
        ),
      );
      const color = (key) => colors[key];
      const scale =
        Math.min(width / 5.5, height / (graph.timeline ? 2.75 : 3.6)) *
        view.zoom;
      const cy = Math.cos(view.yaw),
        sy = Math.sin(view.yaw);
      const cp = Math.cos(view.pitch),
        sp = Math.sin(view.pitch);
      function project([x, y, z]) {
        const depth = -x * sy + z * cy;
        const perspective = 5.8 / (5.8 + y * sp + depth * cp);
        return [
          width / 2 + (x * cy + z * sy) * scale * perspective,
          height / 2 + (y * cp - depth * sp) * scale * perspective,
          perspective,
        ];
      }
      hits = [];
      ctx.globalAlpha = 0.16;
      ctx.strokeStyle = color("edge");
      ctx.lineWidth = 1;
      function gridLine(start, end) {
        const a = project(start),
          b = project(end);
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.stroke();
      }
      const gridHeight = graph.timeline ? 0.85 : 1.25;
      for (const depth of [-1.4, -0.7, 0, 0.7, 1.4])
        gridLine([-2, gridHeight, depth], [2, gridHeight, depth]);
      for (const x of [-2, -1, 0, 1, 2])
        gridLine([x, gridHeight, -1.4], [x, gridHeight, 1.4]);
      ctx.globalAlpha = 1;
      const path = (a, m, b) => {
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.quadraticCurveTo(
          2 * m[0] - (a[0] + b[0]) / 2,
          2 * m[1] - (a[1] + b[1]) / 2,
          b[0],
          b[1],
        );
      };
      if (graph.timeline) {
        ctx.beginPath();
        graph.nodes.forEach((node, i) => {
          const [x, y] = project(node.point);
          if (i) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        });
        ctx.lineWidth = 2;
        ctx.strokeStyle = color("edge");
        ctx.stroke();
      }
      const plotted = graph.edges
        .map((edge) => ({
          edge,
          a: project(edge.from.point),
          m: project(edge.bend),
          b: project(edge.to.point),
        }))
        .sort((a, b) => a.m[2] - b.m[2]);
      const ordered = [
        ...plotted.filter((row) => row.edge.id !== selected.edge),
        ...plotted.filter((row) => row.edge.id === selected.edge),
      ];
      for (const { edge, a, m, b } of ordered) {
        const current = edge.id === selected.edge;
        const connected =
          !selected.node || [edge.from.id, edge.to.id].includes(selected.node);
        ctx.globalAlpha = connected ? 1 : 0.27;
        path(a, m, b);
        ctx.lineWidth = current ? 4 : 1.8;
        ctx.strokeStyle = color(current ? "selected" : "edge");
        ctx.setLineDash(edge.level === "high" ? [7, 5] : []);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = ctx.strokeStyle;
        ctx.beginPath();
        ctx.arc(m[0], m[1], current ? 7 : 4.5, 0, Math.PI * 2);
        ctx.fill();
        if (current) {
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(m[0], m[1], 11, 0, Math.PI * 2);
          ctx.stroke();
        }
        hits.push({ x: m[0], y: m[1], radius: 13, edge: edge.id });
        ctx.globalAlpha = 1;
      }
      ctx.font = "600 12px Manrope, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const { node, point } of graph.nodes
        .map((node) => ({ node, point: project(node.point) }))
        .sort((a, b) => a.point[2] - b.point[2])) {
        const [x, y, depth] = point;
        const radius = clamp(9 * depth, 7, 15);
        ctx.fillStyle = color(node.type);
        ctx.strokeStyle = color(
          node.id === selected.node ? "selected" : "label",
        );
        ctx.lineWidth = node.id === selected.node ? 3 : 1.25;
        ctx.beginPath();
        if (node.type === "customer") ctx.arc(x, y, radius, 0, Math.PI * 2);
        else ctx.rect(x - radius, y - radius, radius * 2, radius * 2);
        ctx.fill();
        ctx.stroke();
        hits.push({ x, y, radius: radius + 6, node: node.id });
        if (
          !graph.timeline &&
          graph.nodes.length > 14 &&
          node.id !== selected.node &&
          !graph.edges.some(
            (edge) =>
              edge.id === selected.edge &&
              (edge.from === node || edge.to === node),
          )
        )
          continue;
        const label =
          node.label.length > 22 ? node.label.slice(0, 21) + "…" : node.label;
        ctx.lineWidth = 4;
        ctx.strokeStyle = color("surface");
        ctx.strokeText(label, x, y + radius + 11);
        ctx.fillStyle = color("label");
        ctx.fillText(label, x, y + radius + 11);
      }
    }
    function move(next) {
      cancelAnimationFrame(frame);
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        Object.assign(view, next);
        paint();
        return;
      }
      const from = { ...view },
        start = performance.now();
      function step(now) {
        const progress = 1 - Math.pow(1 - clamp((now - start) / 170, 0, 1), 3);
        for (const key of Object.keys(next))
          view[key] = from[key] + (next[key] - from[key]) * progress;
        paint();
        if (progress < 1) frame = requestAnimationFrame(step);
      }
      frame = requestAnimationFrame(step);
    }
    const rotate = (x, y) =>
      move({ yaw: view.yaw + x, pitch: clamp(view.pitch + y, -1.25, 1.25) });
    const zoom = (factor) =>
      move({ zoom: clamp(view.zoom * factor, 0.55, 2.6) });
    const reset = () => move({ yaw: -0.36, pitch: 0.19, zoom: 1 });
    canvas.addEventListener("keydown", (event) => {
      const controls = {
        ArrowLeft: () => rotate(-0.24, 0),
        ArrowRight: () => rotate(0.24, 0),
        ArrowUp: () => rotate(0, -0.2),
        ArrowDown: () => rotate(0, 0.2),
        "+": () => zoom(1.2),
        "=": () => zoom(1.2),
        "-": () => zoom(1 / 1.2),
        Home: reset,
      };
      if (!Object.hasOwn(controls, event.key)) return;
      event.preventDefault();
      controls[event.key]();
    });
    canvas.addEventListener("pointerdown", (event) => {
      if (!event.isPrimary || event.button !== 0) return;
      cancelAnimationFrame(frame);
      pointer = {
        x: event.clientX,
        y: event.clientY,
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
      };
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener("pointermove", (event) => {
      if (!pointer || !event.isPrimary) return;
      pointer.moved ||=
        Math.hypot(
          event.clientX - pointer.startX,
          event.clientY - pointer.startY,
        ) > 4;
      if (!pointer.moved) return;
      view.yaw += (event.clientX - pointer.x) * 0.009;
      view.pitch = clamp(
        view.pitch + (event.clientY - pointer.y) * 0.009,
        -1.25,
        1.25,
      );
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(paint);
      pointer.x = event.clientX;
      pointer.y = event.clientY;
    });
    canvas.addEventListener("pointerup", (event) => {
      if (!pointer || !event.isPrimary) return;
      if (!pointer.moved) {
        const box = canvas.getBoundingClientRect();
        const hit = [...hits]
          .reverse()
          .find(
            ({ x, y, radius }) =>
              Math.hypot(
                event.clientX - box.left - x,
                event.clientY - box.top - y,
              ) <= radius,
          );
        if (hit) onPick(hit);
      }
      pointer = null;
    });
    canvas.addEventListener("pointercancel", () => {
      pointer = null;
    });
    const observer = new ResizeObserver(paint);
    observer.observe(canvas);
    paint();
    return {
      paint,
      rotate,
      zoom,
      reset,
      dispose() {
        cancelAnimationFrame(frame);
        observer.disconnect();
      },
    };
  }
  return { related, fitsTime, layout, timeline, attach };
})();
if (typeof module !== "undefined") module.exports = QNetwork;
