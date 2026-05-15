// tableTool: manages back-side table generation & updates
import { TABLE_TARGET_HEIGHT_RATIO, TABLE_TOP_OFFSET, TABLE_MIN_COLUMNS, TABLE_MAX_COLUMNS, TABLE_MIN_SCALE, TABLE_MAX_SCALE, MERGE_DEBUG } from '../../../constants/mergeDefaults.js'
import { TableGenerator } from '../../../core/table/TableGenerator.js'
import { TableObject } from '../../../core/table/TableObject.js'
import { ref } from 'vue'

export function createTableTool(ctx){
  const { activeSide, coverImg, tableLayer, tableObj, tableGenerator, activeTable, cellsData, selectedProject, setCellsData, redraw } = ctx;
  const DEBUG_VERSION = 'table-debug-2026-04-17-01';

  // 新增: 支持并排多表 (1-3)。默认 1。
  const tableCount = ref(1); // 用户可通过 setTableCount 调整
  const tableObjs = ref([]); // 保存每个子表的 TableObject（绘制在同一总画布上）
  let lastPlacement = null; // 记住最近一次 placement 以便 regenerate / setTableCount 时复用

  const MAX_HEIGHT_RATIO = 0.5; // 表格最大高度为封面的60%
  const MAX_WIDTH_RATIO = 0.18; // 表格总宽度为封面的30%

  // 设置表格位置：表格左上角顶点定位到(x, y)
  function setTablePosition(x, y) {
    if(!tableObj.value) return;
    
    tableLayer.x = x;
    tableLayer.y = y;
    tableObj.value.x = x;
    tableObj.value.y = y;
    
    redraw();
    if(MERGE_DEBUG) console.log('[tableTool] table position set to:', x, y);
  }

  function clamp(val, min, max){
    return Math.max(min, Math.min(max, val));
  }

  function normalizeRotation(value){
    const angle = Number(value);
    if(!Number.isFinite(angle)) return 0;
    return ((angle % 360) + 360) % 360;
  }

  function normalizeScale(value){
    const scale = Number(value);
    if(!Number.isFinite(scale) || scale <= 0) return 1;
    return clamp(scale, TABLE_MIN_SCALE, TABLE_MAX_SCALE);
  }

  function getRotatedBoundsSize(width, height, rotation = 0){
    const safeWidth = Math.max(1, Number.isFinite(+width) ? +width : 1);
    const safeHeight = Math.max(1, Number.isFinite(+height) ? +height : 1);
    const radians = normalizeRotation(rotation) * Math.PI / 180;
    if(!radians){
      return { width: safeWidth, height: safeHeight };
    }
    const sin = Math.abs(Math.sin(radians));
    const cos = Math.abs(Math.cos(radians));
    return {
      width: safeWidth * cos + safeHeight * sin,
      height: safeWidth * sin + safeHeight * cos
    };
  }

  function clampPositionToCover(x, y, width, height, rotation = 0){
    if(!coverImg.value){
      return { x, y };
    }
    const safeWidth = Math.max(1, Number.isFinite(+width) ? +width : 1);
    const safeHeight = Math.max(1, Number.isFinite(+height) ? +height : 1);
    const coverWidth = Math.max(1, Number.isFinite(+coverImg.value?.width) ? +coverImg.value.width : 1);
    const coverHeight = Math.max(1, Number.isFinite(+coverImg.value?.height) ? +coverImg.value.height : 1);
    const rotated = getRotatedBoundsSize(safeWidth, safeHeight, rotation);
    if(rotated.width > coverWidth || rotated.height > coverHeight){
      return {
        x: safeWidth >= coverWidth ? 0 : Math.max(0, Math.min(x, coverWidth - safeWidth)),
        y: safeHeight >= coverHeight ? 0 : Math.max(0, Math.min(y, coverHeight - safeHeight))
      };
    }
    const centerX = x + safeWidth / 2;
    const centerY = y + safeHeight / 2;
    return {
      x: Math.max(rotated.width / 2, Math.min(centerX, coverWidth - rotated.width / 2)) - safeWidth / 2,
      y: Math.max(rotated.height / 2, Math.min(centerY, coverHeight - rotated.height / 2)) - safeHeight / 2
    };
  }

  function calcTableMetrics(subW, placementH, maxAutoH, minVisualH, totalRows, count){
    const firstColWidth = clamp(Math.round(subW * 0.23), 28, Math.max(28, Math.floor(subW * 0.28)));
    const remainingWidth = Math.max(0, subW - firstColWidth);
    const c1 = Math.floor(remainingWidth / 3);
    const c2 = Math.floor(remainingWidth / 3);
    const c3 = remainingWidth - c1 - c2;
    const colWidths = [firstColWidth, c1, c2, c3];
    const minDataColWidth = Math.max(1, Math.min(c1, c2, c3));
    const widthPreferredRow = clamp(Math.floor(minDataColWidth * 0.58), 18, 34);
    const growthCap = totalRows <= 6 ? 2.2 : totalRows <= 8 ? 1.7 : totalRows <= 11 ? 1.45 : 1.25;
    const cappedContentHeight = Math.max(placementH, Math.min(maxAutoH, Math.round(placementH * growthCap)));
    const preferredContentHeight = Math.max(placementH, widthPreferredRow * totalRows, minVisualH);
    const resolvedContentHeight = clamp(preferredContentHeight, placementH, cappedContentHeight);
    const safeRowMax = Math.max(18, Math.min(160, maxAutoH / totalRows));
    let rowHeight = clamp(resolvedContentHeight / totalRows, 18, safeRowMax);
    if(count === 2){
      rowHeight = Math.min(safeRowMax, rowHeight * 1.06);
    }
    const baseFontSize = clamp(Math.floor(Math.min(rowHeight * 0.44, minDataColWidth * 0.44, 28)), 11, 28);

    return {
      rowHeight,
      colWidths,
      baseFontSize,
      contentHeight: Math.round(rowHeight * totalRows)
    };
  }

  function fitCellFont(text, cellW, cellH, baseFontSize, opts={}){
    const safeText = String(text ?? '');
    const charCount = Math.max(1, safeText.length);
    const paddingX = opts.paddingX ?? 8;
    const charWidthFactor = opts.charWidthFactor ?? 0.62;
    const heightRatio = opts.heightRatio ?? 0.52;
    const minFontSize = opts.minFontSize ?? 9;
    const widthBound = Math.floor((cellW - paddingX) / Math.max(0.01, charCount * charWidthFactor));
    const heightBound = Math.floor(cellH * heightRatio);
    return clamp(Math.min(baseFontSize, widthBound, heightBound), minFontSize, baseFontSize);
  }

  function drawCenteredText(g, text, x, y, cellW, cellH, baseFontSize, color='#000', opts={}){
    const fontSize = fitCellFont(text, cellW, cellH, baseFontSize, opts);
    g.fillStyle = color;
    g.font = `${opts.fontWeight || 'bold'} ${fontSize}px Arial`;
    g.fillText(String(text ?? ''), x + cellW / 2, y + cellH / 2);
  }

  function ensureTable(opts={}){
    if(activeSide.value !== 'back') return;
    const placement = opts.placement || lastPlacement || null; // {x,y,w,h,has}
    const hasPlacement = !!(placement && placement.has && placement.w>0 && placement.h>0)
    if(hasPlacement) lastPlacement = placement; // 记录
    let cellsToUse = cellsData?.value;
    if(!cellsToUse && selectedProject.value?.result?.cells){
      cellsToUse = selectedProject.value.result.cells;
      if(setCellsData) setCellsData(cellsToUse);
    }
    if(!cellsToUse) { if(MERGE_DEBUG) console.warn('[tableTool] no cells'); return; }
    if(!tableGenerator.value) tableGenerator.value = new TableGenerator(cellsToUse);
    // 当 tableObj 为空或强制重建(force)时生成
    if(!tableObj.value || opts.force){
      if(!hasPlacement){
        if(MERGE_DEBUG) console.warn('[tableTool] missing placement, skip create');
        return;
      }
      const hasExistingLayerSize =
        Number.isFinite(+tableLayer.w) && +tableLayer.w > 0 &&
        Number.isFinite(+tableLayer.h) && +tableLayer.h > 0;
      const shouldReuseLayerPosition = !!tableObj.value || hasExistingLayerSize;
      const previousX = shouldReuseLayerPosition && Number.isFinite(+tableLayer.x) ? +tableLayer.x : placement.x;
      const previousY = shouldReuseLayerPosition && Number.isFinite(+tableLayer.y) ? +tableLayer.y : placement.y;
      const previousScale = shouldReuseLayerPosition ? normalizeScale(tableLayer.scale) : 1;
      const previousRotate = shouldReuseLayerPosition
        ? normalizeRotation(tableLayer.rotate)
        : normalizeRotation(placement.rotation);
      let posX = 0, posY = 60;
      // 如果有 placement，使用“第一列正方形 + 其它列均分”填充逻辑，宽度完全填满
      // 生成多表或单表：按 tableCount 切分宽度；规则
      // 1 表: 与原逻辑一致
      // 2 表: 每表宽度 = 总宽 / 2，内部行高放大 1.5 倍（若超出高度则回落），高度仍受 placement.h 限制
      // 3 表: 平均宽度，总高度不变
      const count = Math.min(TABLE_MAX_COLUMNS, Math.max(TABLE_MIN_COLUMNS, Number(tableLayer.columns || tableCount.value) || 1));
      tableCount.value = count;
      tableLayer.columns = count;
      const headerRows = 1;
      const footerRows = 1;
      const cellsToUseLocal = tableGenerator.value.colorStats || [];
      const dataRowsActual = cellsToUseLocal.length;
      const totalRows = headerRows + dataRowsActual + footerRows;
      const coverHeight = coverImg.value?.height || 0;
      const bottomPadding = coverHeight > 0 ? Math.max(20, Math.round(coverHeight * 0.03)) : 20;
      const safeBottomHeight = coverHeight > 0 ? Math.max(placement.h, coverHeight - placement.y - bottomPadding) : placement.h;
      const maxAutoHeight = Math.max(placement.h, coverHeight > 0 ? Math.min(safeBottomHeight, Math.round(coverHeight * TABLE_TARGET_HEIGHT_RATIO)) : placement.h);
      const minVisualHeight = totalRows <= 6
        ? Math.min(
            maxAutoHeight,
            Math.max(
              Math.round((coverHeight || 1000) * 0.18),
              Math.round(placement.w * 0.72),
              420
            )
          )
        : totalRows <= 8
          ? Math.min(
              maxAutoHeight,
              Math.max(
                Math.round((coverHeight || 1000) * 0.16),
                Math.round(placement.w * 0.62),
                360
              )
            )
          : placement.h;
      const metricsByTable = [];
      let contentHeight = 0;
      for(let i=0;i<count;i++){
        const subX = Math.round(i * (placement.w / count));
        const subW = (i === count-1)? (placement.w - subX) : Math.round((placement.w / count));
        const metrics = calcTableMetrics(subW, placement.h, maxAutoHeight, minVisualHeight, totalRows, count);
        metricsByTable.push({ subX, subW, ...metrics });
        contentHeight = Math.max(contentHeight, metrics.contentHeight);
      }
      if(MERGE_DEBUG){
        const metricsPayload = {
          version: DEBUG_VERSION,
          placement,
          coverHeight,
          tableCount: count,
          totalRows,
          dataRowsActual,
          maxAutoHeight,
          minVisualHeight,
          contentHeight,
          metricsByTable: metricsByTable.map(m => ({
            subX: m.subX,
            subW: m.subW,
            rowHeight: m.rowHeight,
            contentHeight: m.contentHeight,
            colWidths: m.colWidths,
            baseFontSize: m.baseFontSize
          }))
        };
        console.log('[tableTool][metrics]', metricsPayload);
        console.log('[tableTool][metrics.json]', JSON.stringify(metricsPayload));
      }
      // 总画布：四边各留 1px，配合内缩 strokeRect(+0.5)，避免上下左右贴边时 1px 描边一半被裁掉
      const bleedPx = 1;
      const canvas = document.createElement('canvas');
      canvas.width = placement.w + 2 * bleedPx;
      canvas.height = contentHeight + 2 * bleedPx;
      const g = canvas.getContext('2d');
      g.imageSmoothingEnabled = false;
      g.translate(bleedPx, bleedPx);
      g.textAlign = 'center'; g.textBaseline='middle';
      const strokeCell = (x, y, cw, ch) => {
        g.lineWidth = 1;
        if (cw <= 1 || ch <= 1) {
          g.strokeRect(x, y, cw, ch);
          return;
        }
        g.strokeRect(x + 0.5, y + 0.5, cw - 1, ch - 1);
      };
      tableObjs.value = [];
      for(let i=0;i<count;i++){
        const { subX, subW, colWidths, rowHeight, baseFontSize } = metricsByTable[i];
        const headerFontSize = Math.max(11, Math.floor(baseFontSize * 0.92));
        const bodyFontSize = Math.min(32, Math.round(baseFontSize * 1.08));
        const codeFontSize = Math.min(46, Math.round(baseFontSize * 1.58));
        const numberFontSize = Math.min(50, Math.round(baseFontSize * 1.72));
        const headerTextOpts = { paddingX: 12, charWidthFactor: 0.74, heightRatio: 0.44, minFontSize: 8 };
        const bodyTextOpts = { paddingX: 8, charWidthFactor: 0.56, heightRatio: 0.62, minFontSize: 10 };
        const codeTextOpts = { paddingX: 4, charWidthFactor: 0.44, heightRatio: 0.86, minFontSize: 12, fontWeight: '800' };
        const numberTextOpts = { paddingX: 4, charWidthFactor: 0.44, heightRatio: 0.86, minFontSize: 12, fontWeight: '800' };
        const totalTextOpts = { paddingX: 10, charWidthFactor: 0.68, heightRatio: 0.56, minFontSize: 9 };
        // 开始绘制该子表
        let cursorY = 0;
        let colX = subX;
        const headers = ['#','Code','No.','Bag.'];
        // 表头
        for(let c=0;c<4;c++){
          const w = colWidths[c];
          g.fillStyle='#f0f0f0'; g.fillRect(colX,cursorY,w,rowHeight);
          g.strokeStyle='#000'; strokeCell(colX,cursorY,w,rowHeight);
          // 表头文字颜色逻辑：Code 使用黑/白对比色；Bag 使用蓝色；其它用黑色
          let color = '#000';
          if(c===1){
            const headerBg = '#f0f0f0';
            color = tableGenerator.value?.getContrastColor ? tableGenerator.value.getContrastColor(headerBg) : '#000';
          }
          drawCenteredText(g, headers[c], colX, cursorY, w, rowHeight, headerFontSize, color, headerTextOpts);
          colX += w;
        }
        cursorY += rowHeight;
        // 数据行
        for(let r=0;r<dataRowsActual;r++){
          const stat = cellsToUseLocal[r];
          colX = subX;
          for(let c=0;c<4;c++){
            const w = colWidths[c]; g.strokeStyle='#000';
            if(c===0){
              g.fillStyle='#fff'; g.fillRect(colX,cursorY,w,rowHeight); strokeCell(colX,cursorY,w,rowHeight); drawCenteredText(g, String(r+1), colX, cursorY, w, rowHeight, numberFontSize, '#ff0000', numberTextOpts);
            } else if(c===1){
              g.fillStyle = stat.color || '#ccc'; g.fillRect(colX,cursorY,w,rowHeight); strokeCell(colX,cursorY,w,rowHeight);
              const contrast = tableGenerator.value?.getContrastColor ? tableGenerator.value.getContrastColor(stat.color || '#ccc') : '#000';
              drawCenteredText(g, stat.code, colX, cursorY, w, rowHeight, codeFontSize, contrast, codeTextOpts);
            } else if(c===2){
              g.fillStyle='#fff'; g.fillRect(colX,cursorY,w,rowHeight); strokeCell(colX,cursorY,w,rowHeight); drawCenteredText(g, stat.No, colX, cursorY, w, rowHeight, numberFontSize, '#000', numberTextOpts);
            } else {
              g.fillStyle='#fff'; g.fillRect(colX,cursorY,w,rowHeight); strokeCell(colX,cursorY,w,rowHeight); drawCenteredText(g, String(Math.ceil(stat.count/200)), colX, cursorY, w, rowHeight, numberFontSize, '#64CFFA', numberTextOpts);
            }
            colX += w;
          }
          cursorY += rowHeight;
          if(cursorY + rowHeight * 2 > contentHeight) break; // 预留汇总行, 防止溢出
        }
        // 汇总行
        const totalBags = cellsToUseLocal.reduce((sum,s)=> sum + Math.ceil(s.count/200),0);
        colX = subX;
        for(let c=0;c<4;c++){
          const w = colWidths[c]; g.fillStyle='#e0e0e0'; g.fillRect(colX,cursorY,w,rowHeight); g.strokeStyle='#000'; strokeCell(colX,cursorY,w,rowHeight);
          if(c===1){
            drawCenteredText(g, 'total', colX, cursorY, w, rowHeight, Math.max(10, Math.floor(baseFontSize * 0.95)), '#000', totalTextOpts);
          } else if(c===3){
            drawCenteredText(g, `${totalBags}`, colX, cursorY, w, rowHeight, numberFontSize, '#ff0000', numberTextOpts);
          }
          colX += w; }
        cursorY += rowHeight;
        // 记录子表对象（逻辑尺寸 = subW * cursorY，不单独缩放）
        tableObjs.value.push(new TableObject({ bitmap: canvas, baseW: subW, baseH: cursorY }));
      }
      // 主对象仍统一占满矩形，供外层交互使用
      tableLayer.w = placement.w;
      tableLayer.h = contentHeight;
      tableLayer.scale = previousScale;
      tableLayer.rotate = previousRotate;
      tableLayer.maxRowsPerTable = dataRowsActual;
      tableObj.value = new TableObject({ bitmap: canvas, baseW: placement.w, baseH: contentHeight });
      tableObj.value.scale = tableLayer.scale;
      tableObj.value.scaleX = null;
      tableObj.value.scaleY = null;
      tableObj.value.rotate = tableLayer.rotate;
      activeTable.value = true;
      posX = previousX; posY = previousY;
      const clamped = clampPositionToCover(posX, posY, tableLayer.w * tableLayer.scale, tableLayer.h * tableLayer.scale, tableLayer.rotate);
      setTablePosition(clamped.x, clamped.y);
      if(MERGE_DEBUG) {
        const builtPayload = {
        version: DEBUG_VERSION,
        placement,
        count,
        tableLayer: { x: tableLayer.x, y: tableLayer.y, w: tableLayer.w, h: tableLayer.h, scale: tableLayer.scale, rotate: tableLayer.rotate },
        tableObj: { baseW: tableObj.value?.baseW, baseH: tableObj.value?.baseH }
        };
        console.log('[tableTool] multi/single table built', builtPayload);
        console.log('[tableTool] multi/single table built.json', JSON.stringify(builtPayload));
      }
    }
  }

  function regenerateTable(){
    if(lastPlacement){
      if(MERGE_DEBUG) {
        const rebuildPayload = { version: DEBUG_VERSION, lastPlacement, tableCount: tableCount.value };
        console.log('[tableTool] regenerateTable -> rebuild from lastPlacement', rebuildPayload);
        console.log('[tableTool] regenerateTable -> rebuild from lastPlacement.json', JSON.stringify(rebuildPayload));
      }
      tableObj.value = null;
      ensureTable({ placement: lastPlacement, force: true });
      redraw();
      return;
    }

    if(!tableObj.value) return;
    redraw();
  }

  function setTableCount(n, opts = {}){
    const prev = tableCount.value;
    n = Math.min(TABLE_MAX_COLUMNS, Math.max(TABLE_MIN_COLUMNS, Number(n)||1));
    tableLayer.columns = n;
    if(prev === n){
      if(opts.rebuild === true && lastPlacement){
        tableObj.value = null;
        ensureTable({ placement: lastPlacement, force: true });
        redraw();
      }
      return;
    }
    tableCount.value = n;
    // 重新生成
    if(lastPlacement && opts.rebuild !== false){
      tableObj.value = null; // 清除旧的
      ensureTable({ placement: lastPlacement, force: true });
      redraw();
      if(MERGE_DEBUG) console.log('[tableTool] tableCount changed', { from: prev, to: n });
    }
  }

  return { ensureTable, regenerateTable, setTablePosition, setTableCount, tableCount, tableObjs };
}
