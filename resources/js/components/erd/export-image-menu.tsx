import {
    getNodesBounds,
    getViewportForBounds,
    useReactFlow,
} from '@xyflow/react';
import { toPng, toSvg } from 'html-to-image';
import { Image } from 'lucide-react';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAppearance } from '@/hooks/use-appearance';
import { maximumZoom, minimumZoom } from '@/lib/erd';
import type { DiagramNode } from '@/types';

const marginInPixels = 80;
const smallestImageSide = 640;
const largestImageSide = 4000;
const paddingAroundContent = 0.1;

/**
 * Name the file after the diagram, keeping only what a file name can carry.
 */
function fileNameFor(diagramName: string, extension: string): string {
    const stem =
        diagramName
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '') || 'diagram';

    return `${stem}.${extension}`;
}

type Props = {
    diagramName: string;
};

/**
 * Save the drawing as a picture.
 *
 * What is captured is the viewport element, which holds the tables, notes and
 * relations and nothing else — the toolbar, the minimap and the zoom controls
 * live outside it, so they cannot end up in the picture.
 */
export default function ExportImageMenu({ diagramName }: Props) {
    const { getNodes } = useReactFlow<DiagramNode>();
    const { resolvedAppearance } = useAppearance();
    const [isExporting, setIsExporting] = useState(false);

    const download = useCallback(
        async (extension: 'png' | 'svg') => {
            const nodes = getNodes();

            if (nodes.length === 0) {
                return;
            }

            const viewportElement = document.querySelector<HTMLElement>(
                '.react-flow__viewport',
            );

            if (!viewportElement) {
                return;
            }

            setIsExporting(true);

            try {
                const bounds = getNodesBounds(nodes);

                const width = Math.min(
                    Math.max(
                        bounds.width + marginInPixels * 2,
                        smallestImageSide,
                    ),
                    largestImageSide,
                );
                const height = Math.min(
                    Math.max(
                        bounds.height + marginInPixels * 2,
                        smallestImageSide,
                    ),
                    largestImageSide,
                );

                const viewport = getViewportForBounds(
                    bounds,
                    width,
                    height,
                    minimumZoom,
                    maximumZoom,
                    paddingAroundContent,
                );

                const options = {
                    backgroundColor:
                        resolvedAppearance === 'dark' ? '#0a0a0a' : '#ffffff',
                    width,
                    height,
                    style: {
                        width: `${width}px`,
                        height: `${height}px`,
                        transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
                    },
                };

                const dataUrl = await (extension === 'png'
                    ? toPng(viewportElement, options)
                    : toSvg(viewportElement, options));

                const link = document.createElement('a');

                link.href = dataUrl;
                link.download = fileNameFor(diagramName, extension);
                link.click();
            } catch {
                toast.error('The picture could not be made.');
            } finally {
                setIsExporting(false);
            }
        },
        [diagramName, getNodes, resolvedAppearance],
    );

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    size="sm"
                    variant="ghost"
                    disabled={isExporting}
                    title="Save as a picture"
                    data-test="export-image"
                >
                    <Image />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem
                    onSelect={() => download('png')}
                    data-test="export-png"
                >
                    PNG
                </DropdownMenuItem>
                <DropdownMenuItem
                    onSelect={() => download('svg')}
                    data-test="export-svg"
                >
                    SVG
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
